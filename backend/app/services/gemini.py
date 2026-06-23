"""
CortexOS — Gemini Service
Calls Google Gemini API directly via httpx (no SDK needed).
"""
import httpx
import json
import asyncio
from typing import AsyncGenerator
from app.core.config import settings

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
GEMINI_STREAM_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent"
GEMINI_FALLBACK_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

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
    """Non-streaming call — returns the full response as a string.
    Retries with backoff on 429, falls back to gemini-2.0-flash."""
    payload = _build_payload(messages, system_override, system_prompt)

    urls = [GEMINI_URL, GEMINI_FALLBACK_URL]
    wait_times = [3, 8]  # seconds to wait before each retry

    async with httpx.AsyncClient(timeout=60.0) as client:
        for attempt, (url, wait) in enumerate(zip(urls, wait_times)):
            try:
                if attempt > 0:
                    print(f"[Gemini] Waiting {wait}s before retry with fallback model...")
                    await asyncio.sleep(wait)

                response = await client.post(
                    f"{url}?key={settings.GEMINI_API_KEY}",
                    json=payload,
                )

                if response.status_code == 429:
                    print(f"[Gemini] 429 on attempt {attempt + 1}")
                    if attempt < len(urls) - 1:
                        continue
                    return "⚠️ Limite de débit Gemini atteinte. Attendez 30 secondes et réessayez."

                response.raise_for_status()
                data = response.json()
                try:
                    return data["candidates"][0]["content"]["parts"][0]["text"]
                except (KeyError, IndexError):
                    return "Désolé, je n'ai pas pu générer une réponse."

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429 and attempt < len(urls) - 1:
                    continue
                raise

    return "Désolé, je n'ai pas pu générer une réponse."


async def stream_chat_with_gemini(
    messages: list[dict],
    system_prompt: str | None = None,
    system_override: str | None = None,
) -> AsyncGenerator[str, None]:
    """
    Streaming call — yields text chunks as they arrive from Gemini.
    Falls back to non-streaming on 429.
    """
    payload = _build_payload(messages, system_override, system_prompt)

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{GEMINI_STREAM_URL}?key={settings.GEMINI_API_KEY}&alt=sse",
                json=payload,
            ) as response:
                if response.status_code == 429:
                    # Fallback to non-streaming
                    print("[Gemini] 429 on stream, falling back to non-streaming...")
                    await asyncio.sleep(5)
                    result = await chat_with_gemini(messages, system_prompt, system_override)
                    yield result
                    return

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

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429:
            print("[Gemini] 429 on stream HTTPStatusError, falling back...")
            await asyncio.sleep(5)
            result = await chat_with_gemini(messages, system_prompt, system_override)
            yield result
        else:
            raise
