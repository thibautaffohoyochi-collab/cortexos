"""
CortexOS — Gemini Service
Calls Google Gemini API directly via httpx (no SDK needed).
"""
import httpx
from app.core.config import settings

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

SYSTEM_PROMPT = """Tu es CortexOS, un assistant IA pour les entreprises.
Tu aides les utilisateurs à interroger leurs données d'entreprise en langage naturel.
Tu réponds toujours en français, de manière claire et structurée.

RÈGLES IMPORTANTES :
- Quand tu utilises des données du contexte fourni, tu DOIS citer la source entre crochets : [Nom du document]
- Si le contexte contient des informations pertinentes, base-toi dessus en priorité
- Si tu ne trouves pas l'information dans le contexte, dis-le clairement
- Termine toujours ta réponse par une section "📄 Sources utilisées :" listant les documents consultés"""


async def chat_with_gemini(messages: list[dict]) -> str:
    """
    messages: list of {"role": "user"|"model", "content": "..."}
    Returns the assistant's text response.
    """
    # Build Gemini contents format
    contents = []
    for msg in messages:
        role = "user" if msg["role"] == "user" else "model"
        contents.append({
            "role": role,
            "parts": [{"text": msg["content"]}]
        })

    payload = {
        "system_instruction": {
            "parts": [{"text": SYSTEM_PROMPT}]
        },
        "contents": contents,
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 4096,
        }
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{GEMINI_URL}?key={settings.GEMINI_API_KEY}",
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    # Extract text from response
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        return "Désolé, je n'ai pas pu générer une réponse."
