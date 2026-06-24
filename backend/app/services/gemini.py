"""
CortexOS — AI Service
Primary:  Google Gemini 2.5 Flash
Fallback: Google Gemini 2.0 Flash → Groq llama-3.3-70b
"""
import httpx
import json
import asyncio
from typing import AsyncGenerator
from app.core.config import settings

# ─── Endpoints ────────────────────────────────────────────────────────────────
GEMINI_URL          = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
GEMINI_STREAM_URL   = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent"
GEMINI_FALLBACK_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
GROQ_URL            = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL          = "llama-3.3-70b-versatile"
MISTRAL_URL         = "https://api.mistral.ai/v1/chat/completions"
MISTRAL_MODEL       = "mistral-small-latest"

# ─── System prompt ────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """Tu es CortexOS, un assistant IA pour les entreprises.
Tu aides les utilisateurs à interroger leurs données d'entreprise en langage naturel.
Tu réponds toujours en français, de manière claire et structurée.

RÈGLES IMPORTANTES :
- Quand tu utilises des données du contexte fourni, tu DOIS citer la source entre crochets : [Nom du document]
- Si le contexte contient des informations pertinentes, base-toi dessus en priorité
- Si tu ne trouves pas l'information dans le contexte, dis-le clairement
- Termine toujours ta réponse par une section "📄 Sources utilisées :" listant les documents consultés"""


# ─── Payload builder ──────────────────────────────────────────────────────────
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


# ─── Groq fallback (non-streaming) ────────────────────────────────────────────
async def _call_groq(
    messages: list[dict],
    system_override: str | None = None,
    system_prompt: str | None = None,
) -> str:
    if not settings.GROQ_API_KEY:
        return await _call_mistral(messages, system_override, system_prompt)

    system = system_override or system_prompt or SYSTEM_PROMPT
    groq_messages = [{"role": "system", "content": system}]
    for msg in messages:
        role = "user" if msg["role"] == "user" else "assistant"
        groq_messages.append({"role": role, "content": msg["content"]})

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": groq_messages,
                    "temperature": 0.7,
                    "max_tokens": 4096,
                },
            )
            if response.status_code == 429:
                print("[Groq] 429 — trying Mistral fallback")
                return await _call_mistral(messages, system_override, system_prompt)
            response.raise_for_status()
            data = response.json()
            print("[Groq] Response received successfully")
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"[Groq] Error: {e} — trying Mistral")
        return await _call_mistral(messages, system_override, system_prompt)


async def _call_mistral(
    messages: list[dict],
    system_override: str | None = None,
    system_prompt: str | None = None,
) -> str:
    if not settings.MISTRAL_API_KEY:
        return "⚠️ Tous les modèles IA sont saturés. Attendez 1 minute et réessayez."

    system = system_override or system_prompt or SYSTEM_PROMPT
    mistral_messages = [{"role": "system", "content": system}]
    for msg in messages:
        role = "user" if msg["role"] == "user" else "assistant"
        mistral_messages.append({"role": role, "content": msg["content"]})

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                MISTRAL_URL,
                headers={
                    "Authorization": f"Bearer {settings.MISTRAL_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": MISTRAL_MODEL,
                    "messages": mistral_messages,
                    "temperature": 0.7,
                    "max_tokens": 4096,
                },
            )
            if response.status_code == 429:
                return "⚠️ Tous les modèles IA sont saturés. Attendez 1-2 minutes et réessayez."
            response.raise_for_status()
            data = response.json()
            print("[Mistral] Response received successfully")
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"[Mistral] Error: {e}")
        return "⚠️ Tous les modèles IA sont temporairement indisponibles. Réessayez dans 1 minute."


# ─── Groq fallback (streaming) ────────────────────────────────────────────────
async def _stream_groq(
    messages: list[dict],
    system_override: str | None = None,
    system_prompt: str | None = None,
) -> AsyncGenerator[str, None]:
    if not settings.GROQ_API_KEY:
        result = await _call_mistral(messages, system_override, system_prompt)
        yield result
        return

    system = system_override or system_prompt or SYSTEM_PROMPT
    groq_messages = [{"role": "system", "content": system}]
    for msg in messages:
        role = "user" if msg["role"] == "user" else "assistant"
        groq_messages.append({"role": role, "content": msg["content"]})

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": groq_messages,
                    "temperature": 0.7,
                    "max_tokens": 4096,
                    "stream": True,
                },
            ) as response:
                if response.status_code == 429:
                    print("[Groq Stream] 429 → Mistral fallback")
                    result = await _call_mistral(messages, system_override, system_prompt)
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
                        delta = chunk["choices"][0]["delta"].get("content", "")
                        if delta:
                            yield delta
                    except (KeyError, json.JSONDecodeError):
                        continue
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429:
            print("[Groq Stream] HTTPError 429 → Mistral fallback")
            result = await _call_mistral(messages, system_override, system_prompt)
            yield result
        else:
            yield f"⚠️ Erreur Groq: {str(e)[:100]}"
    except Exception as e:
        print(f"[Groq Stream] Error: {e}")
        result = await _call_mistral(messages, system_override, system_prompt)
        yield result


# ─── Main functions ───────────────────────────────────────────────────────────

async def chat_with_gemini(
    messages: list[dict],
    system_prompt: str | None = None,
    system_override: str | None = None,
) -> str:
    """
    Non-streaming call.
    Chain: Gemini 2.5 Flash → Gemini 2.0 Flash → Groq llama-3.3-70b
    """
    payload = _build_payload(messages, system_override, system_prompt)
    urls = [GEMINI_URL, GEMINI_FALLBACK_URL]
    wait_times = [3, 8]

    async with httpx.AsyncClient(timeout=60.0) as client:
        for attempt, (url, wait) in enumerate(zip(urls, wait_times)):
            try:
                if attempt > 0:
                    print(f"[Gemini] Waiting {wait}s before retry...")
                    await asyncio.sleep(wait)

                response = await client.post(
                    f"{url}?key={settings.GEMINI_API_KEY}",
                    json=payload,
                )

                if response.status_code == 429:
                    print(f"[Gemini] 429 on attempt {attempt + 1}")
                    if attempt < len(urls) - 1:
                        continue
                    # All Gemini models rate-limited → Groq
                    print("[AI] Switching to Groq fallback")
                    return await _call_groq(messages, system_override, system_prompt)

                response.raise_for_status()
                data = response.json()
                try:
                    return data["candidates"][0]["content"]["parts"][0]["text"]
                except (KeyError, IndexError):
                    return "Désolé, je n'ai pas pu générer une réponse."

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    if attempt < len(urls) - 1:
                        continue
                    print("[AI] All Gemini 429 → Groq")
                    return await _call_groq(messages, system_override, system_prompt)
                raise

    return await _call_groq(messages, system_override, system_prompt)


async def stream_chat_with_gemini(
    messages: list[dict],
    system_prompt: str | None = None,
    system_override: str | None = None,
) -> AsyncGenerator[str, None]:
    """
    Streaming call.
    Falls back to Groq streaming on 429.
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
                    print("[AI] Gemini stream 429 → Groq stream")
                    await asyncio.sleep(2)
                    async for token in _stream_groq(messages, system_override, system_prompt):
                        yield token
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
            print("[AI] Gemini stream HTTPError 429 → Groq stream")
            async for token in _stream_groq(messages, system_override, system_prompt):
                yield token
        else:
            raise
