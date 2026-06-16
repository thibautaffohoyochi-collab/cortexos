"""
CortexOS — Qdrant Service
Manages vector storage for document chunks.
Uses Gemini embeddings API (free, no extra SDK needed).
"""
import httpx
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct, Filter,
    FieldCondition, MatchValue
)
import uuid

from app.core.config import settings

COLLECTION = "cortexos_docs"
VECTOR_SIZE = 3072  # gemini-embedding-001 size

EMBED_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent"


def get_client() -> AsyncQdrantClient:
    return AsyncQdrantClient(url=settings.QDRANT_URL)


async def ensure_collection():
    """Create Qdrant collection if it doesn't exist."""
    client = get_client()
    result = await client.get_collections()
    existing = [c.name for c in result.collections]
    if COLLECTION not in existing:
        await client.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
    await client.close()


async def embed_text(text: str) -> list[float]:
    """Get embedding vector from Gemini."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            f"{EMBED_URL}?key={settings.GEMINI_API_KEY}",
            json={"model": "models/gemini-embedding-001", "content": {"parts": [{"text": text}]}},
        )
        r.raise_for_status()
        return r.json()["embedding"]["values"]


async def upsert_chunks(chunks: list[dict], tenant_id: str, source_id: str):
    """
    chunks: list of {"text": str, "title": str, "index": int}
    Embeds and stores each chunk in Qdrant.
    """
    await ensure_collection()
    client = get_client()

    points = []
    for chunk in chunks:
        vector = await embed_text(chunk["text"])
        points.append(PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={
                "text": chunk["text"],
                "title": chunk.get("title", ""),
                "tenant_id": tenant_id,
                "source_id": source_id,
                "chunk_index": chunk.get("index", 0),
            }
        ))

    await client.upsert(collection_name=COLLECTION, points=points)
    await client.close()
    return len(points)


async def search(query: str, tenant_id: str, limit: int = 5) -> list[dict]:
    """Search for relevant chunks given a query."""
    await ensure_collection()
    client = get_client()

    vector = await embed_text(query)

    results = await client.query_points(
        collection_name=COLLECTION,
        query=vector,
        query_filter=Filter(
            must=[FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id))]
        ),
        limit=limit,
        with_payload=True,
    )
    await client.close()

    return [
        {
            "text": r.payload["text"],
            "title": r.payload.get("title", ""),
            "score": r.score,
            "source_id": r.payload.get("source_id", ""),
        }
        for r in results.points
    ]


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Split text into overlapping chunks."""
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return chunks
