"""
CortexOS — Web Search Service
Searches the internet using DuckDuckGo (no API key needed) and fetches page content.
Falls back gracefully if a page can't be scraped.
"""
import httpx
import re
from urllib.parse import quote_plus
from typing import Any


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}

DDG_URL = "https://html.duckduckgo.com/html/"


def _strip_html(html: str) -> str:
    """Remove HTML tags and collapse whitespace."""
    text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"&quot;", '"', text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


async def search_web(query: str, max_results: int = 6) -> list[dict[str, str]]:
    """
    Search DuckDuckGo and return a list of results:
    [{"title": str, "url": str, "snippet": str}]
    """
    results: list[dict[str, str]] = []

    async with httpx.AsyncClient(
        headers=HEADERS,
        follow_redirects=True,
        timeout=15.0,
    ) as client:
        try:
            resp = await client.post(
                DDG_URL,
                data={"q": query, "kl": "fr-fr"},
            )
            resp.raise_for_status()
            html = resp.text

            # Extract result blocks — DDG HTML format
            blocks = re.findall(
                r'<a class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>.*?'
                r'<a class="result__snippet"[^>]*>(.*?)</a>',
                html,
                re.DOTALL,
            )

            for url, title_html, snippet_html in blocks[:max_results]:
                title = _strip_html(title_html).strip()
                snippet = _strip_html(snippet_html).strip()
                if url and title:
                    results.append({"title": title, "url": url, "snippet": snippet})

            # Fallback: simpler pattern if the above found nothing
            if not results:
                links = re.findall(
                    r'<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
                    html, re.DOTALL
                )
                snippets = re.findall(
                    r'class="result__snippet[^"]*"[^>]*>(.*?)</a>',
                    html, re.DOTALL
                )
                for i, (url, title_html) in enumerate(links[:max_results]):
                    title = _strip_html(title_html).strip()
                    snippet = _strip_html(snippets[i]).strip() if i < len(snippets) else ""
                    if url and title:
                        results.append({"title": title, "url": url, "snippet": snippet})

        except Exception as e:
            print(f"[WebSearch] DDG search error: {e}")

    return results


async def fetch_page_content(url: str, max_chars: int = 3000) -> str:
    """
    Fetch a web page and return its text content (stripped of HTML).
    Returns empty string on failure.
    """
    try:
        async with httpx.AsyncClient(
            headers=HEADERS,
            follow_redirects=True,
            timeout=10.0,
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")
            if "text/html" not in content_type:
                return ""
            text = _strip_html(resp.text)
            return text[:max_chars]
    except Exception as e:
        print(f"[WebSearch] Fetch error for {url}: {e}")
        return ""


async def search_and_fetch(query: str, max_results: int = 5, fetch_pages: bool = True) -> dict[str, Any]:
    """
    Full pipeline: search + optionally fetch top page contents.
    Returns {"results": [...], "pages": {...}}
    """
    results = await search_web(query, max_results=max_results)

    pages: dict[str, str] = {}
    if fetch_pages and results:
        # Fetch top 3 pages for richer context
        for r in results[:3]:
            content = await fetch_page_content(r["url"])
            if content:
                pages[r["url"]] = content

    return {"results": results, "pages": pages}
