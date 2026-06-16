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
    # Ensure port 6333 for Qdrant Cloud
    if "cloud.qdrant.io" in url and ":6333" not in url:
        url = url + ":6333"
    return url


async def ensure_collection():
    base = get_qdrant_base()
    headers = get_qdrant_headers()

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Check if collection exists
        r = await client.get(f"{base}/collections/{COLLECTION}", headers=headers)
        if r.status_code == 200:
            return  # Already exists

        # Create collection
        r = await client.put(
            f"{base}/collections/{COLLECTION}",
            headers=headers,
            json={
                "vectors": {
                    "size": VECTOR_SIZE,
                    "distance": "Cosine"
                }
            }
        )
        r.raise_for_status()


async def embed_text(text: str) -> list[float]:
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.post(
            f"{EMBED_URL}?key={settings.GEMINI_API_KEY}",
            json={"model": "models/gemini-embedding-001", "content": {"parts": [{"text": text}]}},
        )
        r.raise_for_status()
        return r.json()["embedding"]["values"]


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
        r = await client.post(
            f"{base}/collections/{COLLECTION}/points/search",
            headers=headers,
            json={
                "vector": vector,
                "limit": limit,
                "with_payload": True,
                "filter": {
                    "must": [
                        {"key": "tenant_id", "match": {"value": tenant_id}}
                    ]
                }
            }
        )
        r.raise_for_status()
        results = r.json().get("result", [])

    return [
        {
            "text": r["payload"]["text"],
            "title": r["payload"].get("title", ""),
            "score": r["score"],
            "source_id": r["payload"].get("source_id", ""),
        }
        for r in results
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
