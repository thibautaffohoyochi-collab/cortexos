"""
CortexOS — User Memory Service
Extracts and stores persistent user context across conversations.
Memory is stored as JSON on the User model and injected into every chat.

Memory structure:
{
  "profile": {
    "sector": "e-commerce",
    "company": "Acme Corp",
    "role": "CEO",
    "language": "fr"
  },
  "preferences": {
    "response_style": "concise",  # concise | detailed
    "output_format": "markdown"   # markdown | plain
  },
  "facts": [
    "Utilise Shopify pour sa boutique",
    "A 3 employés",
    "Cherche à automatiser son support client"
  ],
  "projects": [
    "Lancement produit Q3 2025",
    "Refonte du site web"
  ],
  "last_updated": "2025-06-22T..."
}
"""
import json
from datetime import datetime
from app.services.gemini import chat_with_gemini

MEMORY_EXTRACT_SYSTEM = """Tu es un assistant qui analyse des conversations pour en extraire des informations importantes sur l'utilisateur.
Tu dois extraire UNIQUEMENT les informations factuelles et utiles pour les conversations futures.
Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans explication."""

MEMORY_EXTRACT_PROMPT = """Analyse cette conversation et extrait les informations importantes sur l'utilisateur.

Conversation :
{conversation}

Mémoire actuelle de l'utilisateur :
{current_memory}

Retourne un JSON avec cette structure exacte (garde les valeurs existantes si elles sont toujours valides, mets null si inconnu) :
{{
  "profile": {{
    "sector": "secteur d'activité ou null",
    "company": "nom de l'entreprise ou null",
    "role": "poste/rôle ou null",
    "language": "fr ou en selon la langue utilisée"
  }},
  "preferences": {{
    "response_style": "concise ou detailed selon les retours de l'utilisateur",
    "output_format": "markdown ou plain"
  }},
  "facts": ["fait important 1", "fait important 2"],
  "projects": ["projet en cours 1", "projet en cours 2"]
}}

RÈGLES :
- Ne répète pas ce qui est déjà dans la mémoire actuelle sauf si ça change
- Maximum 5 faits et 3 projets — garde les plus récents et importants
- Si rien de nouveau n'est appris, retourne la mémoire actuelle inchangée
- Réponds UNIQUEMENT avec le JSON, rien d'autre"""


def build_memory_context(memory: dict) -> str:
    """
    Build a system prompt section from the user's memory.
    This is injected at the start of every chat.
    """
    if not memory:
        return ""

    parts = []
    profile = memory.get("profile", {})
    prefs = memory.get("preferences", {})
    facts = memory.get("facts", [])
    projects = memory.get("projects", [])

    parts.append("## Ce que tu sais déjà sur cet utilisateur :")

    if any(profile.values()):
        profile_parts = []
        if profile.get("sector"):
            profile_parts.append(f"secteur : {profile['sector']}")
        if profile.get("company"):
            profile_parts.append(f"entreprise : {profile['company']}")
        if profile.get("role"):
            profile_parts.append(f"rôle : {profile['role']}")
        if profile_parts:
            parts.append(f"- Profil : {', '.join(profile_parts)}")

    if facts:
        parts.append("- Faits importants :")
        for f in facts[:5]:
            parts.append(f"  • {f}")

    if projects:
        parts.append("- Projets en cours :")
        for p in projects[:3]:
            parts.append(f"  • {p}")

    if prefs.get("response_style") == "concise":
        parts.append("- Préférence : réponses concises")
    elif prefs.get("response_style") == "detailed":
        parts.append("- Préférence : réponses détaillées")

    if prefs.get("language") == "en":
        parts.append("- Langue préférée : anglais")

    parts.append("\nUtilise ces informations pour personnaliser tes réponses.")
    return "\n".join(parts)


async def extract_and_update_memory(
    conversation: list[dict],
    current_memory: dict,
) -> dict | None:
    """
    Analyze the last conversation and update user memory.
    Returns updated memory dict, or None if extraction fails.
    Only runs if there are meaningful exchanges (>= 2 messages).
    """
    if len(conversation) < 2:
        return None

    # Build conversation text (last 6 messages max)
    conv_text = ""
    for msg in conversation[-6:]:
        role = "Utilisateur" if msg["role"] == "user" else "Assistant"
        conv_text += f"{role}: {msg['content'][:500]}\n\n"

    prompt = MEMORY_EXTRACT_PROMPT.format(
        conversation=conv_text,
        current_memory=json.dumps(current_memory, ensure_ascii=False, indent=2) if current_memory else "{}",
    )

    try:
        response = await chat_with_gemini(
            [{"role": "user", "content": prompt}],
            system_override=MEMORY_EXTRACT_SYSTEM,
        )

        # Clean response — remove markdown code blocks if present
        response = response.strip()
        if response.startswith("```"):
            lines = response.split("\n")
            response = "\n".join(lines[1:-1]) if len(lines) > 2 else response

        new_memory = json.loads(response)
        new_memory["last_updated"] = datetime.utcnow().isoformat()
        return new_memory

    except (json.JSONDecodeError, Exception) as e:
        print(f"[Memory] Extraction failed: {e}")
        return None
