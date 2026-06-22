"""
CortexOS — Chat Routes
POST /chat/message  → send a message, get AI response (RAG + optional web search)
POST /chat/stream   → same but streams tokens via SSE
GET  /chat/sessions → list chat sessions
GET  /chat/sessions/{id}/messages → get messages of a session
"""
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import uuid

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.models import User, ChatSession, Message
from app.services.gemini import chat_with_gemini, stream_chat_with_gemini
from app.services.qdrant_service import search as qdrant_search
from app.services.websearch_service import search_and_fetch
from app.services.memory_service import build_memory_context, extract_and_update_memory

router = APIRouter(prefix="/chat", tags=["chat"])

HYBRID_SYSTEM = """Tu es CortexOS, un assistant IA pour les entreprises.
Tu as accès à deux sources d'information :
1. Les DONNÉES INTERNES de l'entreprise (documents, emails, fichiers indexés)
2. Des RÉSULTATS DE RECHERCHE WEB en temps réel

RÈGLES :
- Commence par utiliser les données internes si elles sont pertinentes.
- Complète avec les résultats web pour les informations manquantes ou récentes.
- Cite clairement l'origine de chaque information :
  - Données internes : [📂 Nom du document]
  - Web : [🌐 Titre de la page](URL)
- Si les deux sources apportent des infos complémentaires, synthétise-les.
- Termine par une section "📄 Sources utilisées :" listant toutes les références.
- Réponds toujours en français sauf si l'utilisateur écrit dans une autre langue."""


# ─── Schemas ──────────────────────────────────────────────────────────────────

class MessageRequest(BaseModel):
    content: str
    session_id: uuid.UUID | None = None
    web_search: bool = False  # enable hybrid RAG + web search mode

class MessageResponse(BaseModel):
    session_id: uuid.UUID
    user_message: str
    assistant_message: str

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

@router.post("/message", response_model=MessageResponse)
async def send_message(
    body: MessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Get or create session
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
        # New session — title = first 50 chars of message
        title = body.content[:50] + ("..." if len(body.content) > 50 else "")
        session = ChatSession(
            tenant_id=current_user.tenant_id,
            user_id=current_user.id,
            title=title,
        )
        db.add(session)
        await db.flush()

    # Load conversation history (last 10 messages for context)
    history_result = await db.execute(
        select(Message)
        .where(Message.session_id == session.id)
        .order_by(Message.created_at.desc())
        .limit(10)
    )
    history = list(reversed(history_result.scalars().all()))

    # Build messages for Gemini
    gemini_messages = [
        {"role": msg.role, "content": msg.content}
        for msg in history
    ]

    # RAG — search relevant chunks in Qdrant
    rag_context = ""
    try:
        chunks = await qdrant_search(body.content, tenant_id=str(current_user.tenant_id), limit=4)
        print(f"[RAG] Found {len(chunks)} chunks for: {body.content[:60]}")
        if chunks:
            rag_context = "\n\n---\n📂 DONNÉES INTERNES (vos documents d'entreprise) :\n"
            for c in chunks:
                rag_context += f"\n📄 SOURCE : [{c['title']}]\n{c['text']}\n"
    except Exception as e:
        print(f"[RAG] Error: {e}")

    # Web search — only if requested
    web_context = ""
    if body.web_search:
        try:
            search_data = await search_and_fetch(body.content, max_results=4, fetch_pages=False)
            results = search_data.get("results", [])
            if results:
                web_context = "\n\n---\n🌐 RÉSULTATS WEB (recherche internet en temps réel) :\n"
                for r in results:
                    web_context += f"\n🔗 [{r['title']}]({r['url']})\n{r.get('snippet', '')}\n"
            print(f"[WebSearch] Found {len(results)} results for: {body.content[:60]}")
        except Exception as e:
            print(f"[WebSearch] Error: {e}")

    # Build final user message with all context
    user_content = body.content
    if rag_context or web_context:
        user_content = body.content + rag_context + web_context

    gemini_messages.append({"role": "user", "content": user_content})

    # Choose system prompt — hybrid if web search is on
    system = HYBRID_SYSTEM if body.web_search else None

    # Inject user memory into system prompt
    memory_context = build_memory_context(current_user.memory or {})
    if memory_context:
        base_system = system or """Tu es CortexOS, un assistant IA pour les entreprises.
Tu aides les utilisateurs à interroger leurs données d'entreprise en langage naturel.
Tu réponds toujours en français, de manière claire et structurée.
Quand tu utilises des données du contexte fourni, cite la source entre crochets : [Nom du document]."""
        system = f"{base_system}\n\n{memory_context}"

    # Call Gemini
    assistant_reply = await chat_with_gemini(gemini_messages, system_override=system)

    # Save user message
    user_msg = Message(
        session_id=session.id,
        role="user",
        content=body.content,
    )
    db.add(user_msg)

    # Save assistant message
    assistant_msg = Message(
        session_id=session.id,
        role="assistant",
        content=assistant_reply,
    )
    db.add(assistant_msg)

    # Async memory extraction — only every 6 messages to avoid rate limits
    total_messages = len(history) + 2
    if total_messages % 6 == 0:
        import asyncio
        asyncio.create_task(_update_user_memory(
            user_id=str(current_user.id),
            conversation=gemini_messages + [{"role": "assistant", "content": assistant_reply}],
            current_memory=current_user.memory or {},
        ))

    return MessageResponse(
        session_id=session.id,
        user_message=body.content,
        assistant_message=assistant_reply,
    )


async def _update_user_memory(user_id: str, conversation: list[dict], current_memory: dict):
    """Background task — extract memory from conversation and save to user."""
    from app.core.database import AsyncSessionLocal
    from app.models.models import User
    import uuid

    try:
        new_memory = await extract_and_update_memory(conversation, current_memory)
        if not new_memory:
            return

        async with AsyncSessionLocal() as db:
            from sqlalchemy import select
            result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
            user = result.scalar_one_or_none()
            if user:
                user.memory = new_memory
                await db.commit()
                print(f"[Memory] Updated for user {user_id}")
    except Exception as e:
        print(f"[Memory] Update failed: {e}")


# ─── Streaming endpoint ────────────────────────────────────────────────────────

@router.post("/stream")
async def stream_message(
    body: MessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    SSE streaming endpoint.
    Emits chunks: data: {"token": "..."}\n\n
    Final chunk:  data: {"done": true, "session_id": "...", "full": "..."}\n\n
    """
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="Message vide")

    # ── Session ────────────────────────────────────────────────────────────────
    if body.session_id:
        result = await db.execute(
            select(ChatSession).where(
                ChatSession.id == body.session_id,
                ChatSession.tenant_id == current_user.tenant_id,
            )
        )
        chat_session = result.scalar_one_or_none()
        if not chat_session:
            raise HTTPException(status_code=404, detail="Session introuvable")
    else:
        title = body.content[:50] + ("..." if len(body.content) > 50 else "")
        chat_session = ChatSession(
            tenant_id=current_user.tenant_id,
            user_id=current_user.id,
            title=title,
        )
        db.add(chat_session)
        await db.flush()

    session_id = str(chat_session.id)

    # ── History ────────────────────────────────────────────────────────────────
    history_result = await db.execute(
        select(Message)
        .where(Message.session_id == chat_session.id)
        .order_by(Message.created_at.desc())
        .limit(10)
    )
    history = list(reversed(history_result.scalars().all()))
    gemini_messages = [{"role": msg.role, "content": msg.content} for msg in history]

    # ── RAG ────────────────────────────────────────────────────────────────────
    rag_context = ""
    try:
        chunks = await qdrant_search(body.content, tenant_id=str(current_user.tenant_id), limit=4)
        if chunks:
            rag_context = "\n\n---\n📂 DONNÉES INTERNES :\n"
            for c in chunks:
                rag_context += f"\n📄 SOURCE : [{c['title']}]\n{c['text']}\n"
    except Exception as e:
        print(f"[RAG] Error: {e}")

    # ── Web search ─────────────────────────────────────────────────────────────
    web_context = ""
    if body.web_search:
        try:
            search_data = await search_and_fetch(body.content, max_results=4, fetch_pages=False)
            results = search_data.get("results", [])
            if results:
                web_context = "\n\n---\n🌐 RÉSULTATS WEB :\n"
                for r in results:
                    web_context += f"\n🔗 [{r['title']}]({r['url']})\n{r.get('snippet', '')}\n"
        except Exception as e:
            print(f"[WebSearch] Error: {e}")

    user_content = body.content + rag_context + web_context
    gemini_messages.append({"role": "user", "content": user_content})
    system = HYBRID_SYSTEM if body.web_search else None

    # ── Save user message now (before streaming) ───────────────────────────────
    db.add(Message(session_id=chat_session.id, role="user", content=body.content))
    await db.flush()

    # ── Streaming generator ────────────────────────────────────────────────────
    async def event_generator():
        full_text = ""
        # First event: send session_id so frontend knows which session was created
        yield f"data: {json.dumps({'session_id': session_id})}\n\n"

        try:
            async for token in stream_chat_with_gemini(gemini_messages, system_override=system):
                full_text += token
                yield f"data: {json.dumps({'token': token})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            return

        # Final event: save to DB and signal done
        try:
            from app.core.database import AsyncSessionLocal
            async with AsyncSessionLocal() as save_db:
                save_db.add(Message(
                    session_id=uuid.UUID(session_id),
                    role="assistant",
                    content=full_text,
                ))
                await save_db.commit()
        except Exception as e:
            print(f"[Stream] DB save error: {e}")

        yield f"data: {json.dumps({'done': True, 'full': full_text})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering
        },
    )


@router.get("/sessions", response_model=list[SessionResponse])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.tenant_id == current_user.tenant_id)
        .order_by(ChatSession.created_at.desc())
        .limit(50)
    )
    sessions = result.scalars().all()
    return [
        SessionResponse(
            id=s.id,
            title=s.title,
            created_at=s.created_at.isoformat(),
        )
        for s in sessions
    ]


@router.get("/sessions/{session_id}/messages", response_model=list[MessageOut])
async def get_messages(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify session belongs to tenant
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
        MessageOut(
            id=m.id,
            role=m.role,
            content=m.content,
            created_at=m.created_at.isoformat(),
        )
        for m in messages
    ]
