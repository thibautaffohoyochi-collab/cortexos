"""
CortexOS — Competitive Intelligence Service
Scrapes competitor websites and analyzes with Gemini.
"""
import httpx
import re
from datetime import datetime
from app.services.gemini import chat_with_gemini


async def scrape_website(url: str) -> dict:
    """Fetch and extract text content from a website."""
    if not url.startswith("http"):
        url = "https://" + url

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            r = await client.get(url, headers=headers)
            r.raise_for_status()
            html = r.text

        # Extract title
        title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        title = title_match.group(1).strip() if title_match else ""

        # Extract meta description
        meta_match = re.search(r'<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']+)["\']', html, re.IGNORECASE)
        meta_desc = meta_match.group(1).strip() if meta_match else ""

        # Extract body text (strip HTML)
        text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        text = text[:3000]  # limit

        # Extract headings
        headings = re.findall(r"<h[1-3][^>]*>(.*?)</h[1-3]>", html, re.IGNORECASE | re.DOTALL)
        headings = [re.sub(r"<[^>]+>", "", h).strip() for h in headings[:10]]

        return {
            "url": url,
            "title": title,
            "meta_description": meta_desc,
            "headings": headings,
            "content": text,
            "scraped_at": datetime.utcnow().isoformat(),
            "success": True,
        }
    except Exception as e:
        return {
            "url": url,
            "error": str(e),
            "scraped_at": datetime.utcnow().isoformat(),
            "success": False,
        }


async def analyze_competitor(
    competitor_name: str,
    snapshot: dict,
    my_profile: str = "",
) -> str:
    """Use Gemini to analyze a competitor's website data."""

    if not snapshot.get("success"):
        return f"Impossible d'analyser {competitor_name} : {snapshot.get('error', 'erreur inconnue')}"

    content = f"""
Analyse ce concurrent pour moi :

**Nom :** {competitor_name}
**Site :** {snapshot.get('url', '')}
**Titre :** {snapshot.get('title', '')}
**Description :** {snapshot.get('meta_description', '')}
**Titres principaux :** {', '.join(snapshot.get('headings', [])[:5])}
**Contenu extrait :**
{snapshot.get('content', '')[:1500]}

{"**Mon profil pour comparaison :** " + my_profile if my_profile else ""}

Fournis une analyse structurée avec :
1. **Positionnement** — comment se positionne-t-il sur le marché ?
2. **Services/Produits** — qu'est-ce qu'il offre ?
3. **Points forts** — ses avantages apparents
4. **Points faibles** — ses faiblesses ou lacunes
5. **Opportunités** — comment je peux me différencier face à lui ?
6. **Score de menace** — de 1 à 10, à quel point est-il une menace directe ?
"""

    messages = [{"role": "user", "content": content}]
    return await chat_with_gemini(messages)


async def generate_competitive_report(
    competitors_data: list[dict],
    my_profile: str = "",
) -> str:
    """Generate a global competitive analysis report."""

    summaries = "\n\n".join([
        f"**{c['name']}** ({c.get('website', '')})\n{c.get('last_analysis', 'Non analysé')[:500]}"
        for c in competitors_data
    ])

    prompt = f"""
Tu es un consultant en stratégie business. Génère un rapport de veille concurrentielle complet basé sur ces données :

{summaries}

{"**Mon profil :** " + my_profile if my_profile else ""}

Structure ton rapport ainsi :
## Résumé exécutif
## Analyse du paysage concurrentiel
## Opportunités de différenciation
## Recommandations stratégiques
## Score de position concurrentielle (1-10)
"""
    messages = [{"role": "user", "content": prompt}]
    return await chat_with_gemini(messages)
