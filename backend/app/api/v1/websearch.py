"""
CortexOS — Web Search Bot API
POST /websearch/ask  → search the web and synthesize results with Gemini
GET  /websearch/sessions → list websearch sessions
GET  /websearch/sessions/{id}/messages → get messages of a session
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import uuid

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.models import User, ChatSession, Message
from app.services.gemini import chat_with_gemini
from app.services.websearch_service import search_and_fetch

router = APIRouter(prefix="/websearch", tags=["websearch"])

WEBSEARCH_SYSTEM = """Tu es CortexOS WebSearch, un assistant spécialisé dans la recherche sur internet.
Tu reçois une question ainsi que des résultats de recherche web réels (titres, URLs, extraits de pages).
Ton rôle est de synthétiser ces informations pour fournir une réponse complète, structurée et sourcée.

RÈGLES STRICTES :
- Appuie-toi UNIQUEMENT sur les résultats de recherche fournis, ne pas inventer des faits.
- Cite toujours tes sources avec le format : [Titre de la page](URL)
- Si les résultats ne répondent pas à la question, dis-le clairement.
- Réponds en français sauf si l'utilisateur écrit dans une autre langue.
- Sois structuré : utilise des titres, listes à puces si nécessaire.
- À la fin de chaque réponse, ajoute une section "🔗 Sources :" avec les liens cliquables.
- Si une information semble contradictoire entre les sources, signale-le.
- Indique la date de recherche dans ta réponse quand c'est pertinent."""


# ─── Schemas ──────────────────────────────────────────────────────────────────

class WebSearchRequest(BaseModel):
    query: str
    session_id: uuid.UUID | None = None
    fetch_pages: bool = True  # fetch actual page content for richer context


class WebSearchResponse(BaseModel):
    session_id: uuid.UUID
    query: str
    answer: str
    sources: list[dict]  # [{title, url, snippet}]


class SessionResponse(BaseModel):
    id: uuid.UUID
    title: str
    created_at: str
    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    created_at: str
    model_config = {"from_attributes": True}


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/ask", response_model=WebSearchResponse)
async def websearch_ask(
    body: WebSearchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.query.strip():
        raise HTTPException(status_code=400, detail="Requête vide")

    # ── Get or create session ──────────────────────────────────────────────────
    if body.session_id:
        result = await db.execute(
            select(ChatSession).where(
                ChatSession.id == body.session_id,
                ChatSession.tenant_id == current_user.tenant_id,
            )
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Session introuvable")
    else:
        title = "🌐 " + body.query[:47] + ("..." if len(body.query) > 47 else "")
        session = ChatSession(
            tenant_id=current_user.tenant_id,
            user_id=current_user.id,
            title=title,
        )
        db.add(session)
        await db.flush()

    # ── Load conversation history ──────────────────────────────────────────────
    history_result = await db.execute(
        select(Message)
        .where(Message.session_id == session.id)
        .order_by(Message.created_at.desc())
        .limit(8)
    )
    history = list(reversed(history_result.scalars().all()))

    # ── Web search ────────────────────────────────────────────────────────────
    search_data = await search_and_fetch(
        body.query,
        max_results=6,
        fetch_pages=body.fetch_pages,
    )
    results = search_data["results"]
    pages = search_data["pages"]

    # ── Build context for Gemini ───────────────────────────────────────────────
    web_context = f"## Résultats de recherche pour : « {body.query} »\n\n"

    for i, r in enumerate(results, 1):
        web_context += f"### Résultat {i} : {r['title']}\n"
        web_context += f"URL : {r['url']}\n"
        if r.get("snippet"):
            web_context += f"Extrait : {r['snippet']}\n"
        # Add fetched page content if available
        if r["url"] in pages:
            web_context += f"Contenu de la page :\n{pages[r['url']][:1500]}\n"
        web_context += "\n"

    if not results:
        web_context += "Aucun résultat trouvé pour cette recherche.\n"

    # ── Build Gemini messages ──────────────────────────────────────────────────
    gemini_messages = [
        {"role": msg.role, "content": msg.content}
        for msg in history
    ]

    user_content = (
        f"Question : {body.query}\n\n"
        f"---\n"
        f"{web_context}"
    )
    gemini_messages.append({"role": "user", "content": user_content})

    # ── Call Gemini ────────────────────────────────────────────────────────────
    answer = await chat_with_gemini(gemini_messages, system_override=WEBSEARCH_SYSTEM)

    # ── Persist messages ───────────────────────────────────────────────────────
    db.add(Message(session_id=session.id, role="user", content=body.query))
    db.add(Message(session_id=session.id, role="assistant", content=answer))

    return WebSearchResponse(
        session_id=session.id,
        query=body.query,
        answer=answer,
        sources=results,
    )


@router.get("/sessions", response_model=list[SessionResponse])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession)
        .where(
            ChatSession.tenant_id == current_user.tenant_id,
            ChatSession.title.like("🌐 %"),
        )
        .order_by(ChatSession.created_at.desc())
        .limit(50)
    )
    sessions = result.scalars().all()
    return [
        SessionResponse(id=s.id, title=s.title, created_at=s.created_at.isoformat())
        for s in sessions
    ]


@router.get("/sessions/{session_id}/messages", response_model=list[MessageOut])
async def get_messages(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session_result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.tenant_id == current_user.tenant_id,
        )
    )
    if not session_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session introuvable")

    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
    )
    messages = result.scalars().all()
    return [
        MessageOut(id=m.id, role=m.role, content=m.content, created_at=m.created_at.isoformat())
        for m in messages
    ]
