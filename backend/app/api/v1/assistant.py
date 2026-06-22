"""
CortexOS — General Assistant API
POST /assistant/ask  → ask anything to Gemini (no RAG, general knowledge)
No auth required for basic questions, auth for history.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.auth import get_current_user
from app.models.models import User
from app.services.gemini import chat_with_gemini

router = APIRouter(prefix="/assistant", tags=["assistant"])

ASSISTANT_SYSTEM = """Tu es un assistant IA général intégré à CortexOS.
Tu peux répondre à toutes les questions générales : business, marketing, stratégie, 
code, rédaction, analyse, conseils... Tu réponds en français par défaut.
Tu es concis, utile et professionnel.
Si la question concerne des données internes de l'utilisateur, suggère d'utiliser 
le chat principal de CortexOS qui a accès aux données."""


class AskRequest(BaseModel):
    message: str
    history: list[dict] = []  # previous messages for context


@router.post("/ask")
async def ask_assistant(
    body: AskRequest,
    current_user: User = Depends(get_current_user),
):
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message vide")

    messages = []
    # Add conversation history
    for h in body.history[-6:]:  # max 6 previous messages
        if h.get("role") in ("user", "assistant") and h.get("content"):
            messages.append({"role": h["role"], "content": h["content"]})

    messages.append({"role": "user", "content": body.message})

    reply = await chat_with_gemini(messages, system_override=ASSISTANT_SYSTEM)
    return {"reply": reply}
