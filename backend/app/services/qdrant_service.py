"""
CortexOS — Qdrant Service
Uses Qdrant REST API directly via httpx (no SDK needed).
Works with both local Qdrant and Qdrant Cloud.
"""
import httpx
import uuid

from app.core.config import settings

COLLECTION = "cortexos_docs"
VECTOR_SIZE = 3072  # gemini-embedding-001

EMBED_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent"


def get_qdrant_headers() -> dict:
    headers = {"Content-Type": "application/json"}
    if settings.QDRANT_API_KEY:
        headers["api-key"] = settings.QDRANT_API_KEY
    return headers


def get_qdrant_base() -> str:
    url = settings.QDRANT_URL.rstrip("/")
    # Remove any explicit port for Qdrant Cloud — use default HTTPS (443)
    import re
    if "cloud.qdrant.io" in url:
        url = re.sub(r':\d+$', '', url)
    return url


async def ensure_collection():
    base = get_qdrant_base()
    headers = get_qdrant_headers()

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Check if collection exists
        r = await client.get(f"{base}/collections/{COLLECTION}", headers=headers)
        if r.status_code == 200:
            # Ensure tenant_id index exists (required for strict mode)
            await client.put(
                f"{base}/collections/{COLLECTION}/index",
                headers=headers,
                json={"field_name": "tenant_id", "field_schema": "keyword"}
            )
            return

        # Create collection
        r = await client.put(
            f"{base}/collections/{COLLECTION}",
            headers=headers,
            json={"vectors": {"size": VECTOR_SIZE, "distance": "Cosine"}}
        )
        r.raise_for_status()

        # Create tenant_id index for filtering
        await client.put(
            f"{base}/collections/{COLLECTION}/index",
            headers=headers,
            json={"field_name": "tenant_id", "field_schema": "keyword"}
        )


async def embed_text(text: str) -> list[float]:
    # Truncate text to avoid issues with very long inputs
    text = text[:2000] if len(text) > 2000 else text
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.post(
            f"{EMBED_URL}?key={settings.GEMINI_API_KEY}",
            json={"model": "models/gemini-embedding-001", "content": {"parts": [{"text": text}]}},
        )
        r.raise_for_status()
        vector = r.json()["embedding"]["values"]
        # Ensure correct dimension
        if len(vector) != VECTOR_SIZE:
            raise ValueError(f"Embedding dimension mismatch: got {len(vector)}, expected {VECTOR_SIZE}")
        return vector


async def upsert_chunks(chunks: list[dict], tenant_id: str, source_id: str) -> int:
    await ensure_collection()
    base = get_qdrant_base()
    headers = get_qdrant_headers()

    points = []
    for chunk in chunks:
        vector = await embed_text(chunk["text"])
        points.append({
            "id": str(uuid.uuid4()),
            "vector": vector,
            "payload": {
                "text": chunk["text"],
                "title": chunk.get("title", ""),
                "tenant_id": tenant_id,
                "source_id": source_id,
                "chunk_index": chunk.get("index", 0),
            }
        })

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.put(
            f"{base}/collections/{COLLECTION}/points",
            headers=headers,
            json={"points": points}
        )
        r.raise_for_status()

    return len(points)


async def search(query: str, tenant_id: str, limit: int = 5) -> list[dict]:
    await ensure_collection()
    base = get_qdrant_base()
    headers = get_qdrant_headers()

    vector = await embed_text(query)

    async with httpx.AsyncClient(timeout=20.0) as client:
        # Search without filter (avoid strict mode issues), filter client-side
        r = await client.post(
            f"{base}/collections/{COLLECTION}/points/search",
            headers=headers,
            json={
                "vector": vector,
                "limit": limit * 4,  # fetch more, filter client-side
                "with_payload": True,
            }
        )
        r.raise_for_status()
        results = r.json().get("result", [])

    # Filter by tenant_id client-side
    filtered = [
        r for r in results
        if r.get("payload", {}).get("tenant_id") == tenant_id
    ][:limit]

    return [
        {
            "text": r["payload"]["text"],
            "title": r["payload"].get("title", ""),
            "score": r["score"],
            "source_id": r["payload"].get("source_id", ""),
        }
        for r in filtered
    ]


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return chunks
