"""
CortexOS — Gemini Service
Calls Google Gemini API directly via httpx (no SDK needed).
"""
import httpx
import json
from typing import AsyncGenerator
from app.core.config import settings

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
GEMINI_STREAM_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent"

SYSTEM_PROMPT = """Tu es CortexOS, un assistant IA pour les entreprises.
Tu aides les utilisateurs à interroger leurs données d'entreprise en langage naturel.
Tu réponds toujours en français, de manière claire et structurée.

RÈGLES IMPORTANTES :
- Quand tu utilises des données du contexte fourni, tu DOIS citer la source entre crochets : [Nom du document]
- Si le contexte contient des informations pertinentes, base-toi dessus en priorité
- Si tu ne trouves pas l'information dans le contexte, dis-le clairement
- Termine toujours ta réponse par une section "📄 Sources utilisées :" listant les documents consultés"""


def _build_payload(
    messages: list[dict],
    system_override: str | None = None,
    system_prompt: str | None = None,
) -> dict:
    contents = []
    for msg in messages:
        role = "user" if msg["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg["content"]}]})
    return {
        "system_instruction": {
            "parts": [{"text": system_override or system_prompt or SYSTEM_PROMPT}]
        },
        "contents": contents,
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 4096,
        },
    }


async def chat_with_gemini(
    messages: list[dict],
    system_prompt: str | None = None,
    system_override: str | None = None,
) -> str:
    """Non-streaming call — returns the full response as a string."""
    payload = _build_payload(messages, system_override, system_prompt)

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{GEMINI_URL}?key={settings.GEMINI_API_KEY}",
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        return "Désolé, je n'ai pas pu générer une réponse."


async def stream_chat_with_gemini(
    messages: list[dict],
    system_prompt: str | None = None,
    system_override: str | None = None,
) -> AsyncGenerator[str, None]:
    """
    Streaming call — yields text chunks as they arrive from Gemini.
    Uses SSE format: yields lines like 'data: <token>\n\n'
    """
    payload = _build_payload(messages, system_override, system_prompt)

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            f"{GEMINI_STREAM_URL}?key={settings.GEMINI_API_KEY}&alt=sse",
            json=payload,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                raw = line[5:].strip()
                if not raw or raw == "[DONE]":
                    continue
                try:
                    chunk = json.loads(raw)
                    text = chunk["candidates"][0]["content"]["parts"][0]["text"]
                    if text:
                        yield text
                except (KeyError, IndexError, json.JSONDecodeError):
                    continue
