"""
CortexOS — Data Sources Routes
POST /sources/upload  → upload CSV or TXT file, ingest into Qdrant
GET  /sources         → list data sources for tenant
DELETE /sources/{id}  → delete a source
"""
import csv
import io
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.models import User, DataSource, SourceType, SourceStatus
from app.services.qdrant_service import upsert_chunks, chunk_text

router = APIRouter(prefix="/sources", tags=["sources"])

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def parse_csv(content: str, filename: str) -> list[dict]:
    """Parse CSV and return list of chunk dicts."""
    reader = csv.DictReader(io.StringIO(content))
    rows = list(reader)
    if not rows:
        return []

    # Convert rows to text blocks
    all_text = ""
    for row in rows:
        line = " | ".join(f"{k}: {v}" for k, v in row.items() if v)
        all_text += line + "\n"

    chunks = chunk_text(all_text, chunk_size=300, overlap=30)
    return [{"text": c, "title": filename, "index": i} for i, c in enumerate(chunks)]


def parse_txt(content: str, filename: str) -> list[dict]:
    """Parse plain text and return chunk dicts."""
    chunks = chunk_text(content, chunk_size=400, overlap=50)
    return [{"text": c, "title": filename, "index": i} for i, c in enumerate(chunks)]


@router.post("/upload")
async def upload_source(
    file: UploadFile = File(...),
    name: str = Form(default=""),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate file type
    filename = file.filename or "document"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext not in ("csv", "txt"):
        raise HTTPException(status_code=400, detail="Seuls les fichiers .csv et .txt sont supportés pour l'instant.")

    # Read file
    raw = await file.read()
    if len(raw) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 5 MB).")

    content = raw.decode("utf-8", errors="replace")
    source_name = name or filename

    # Parse into chunks
    if ext == "csv":
        chunks = parse_csv(content, source_name)
        source_type = SourceType.CSV
    else:
        chunks = parse_txt(content, source_name)
        source_type = SourceType.CSV  # use CSV as generic for now

    if not chunks:
        raise HTTPException(status_code=400, detail="Le fichier est vide ou non parseable.")

    # Create DataSource record
    source = DataSource(
        tenant_id=current_user.tenant_id,
        name=source_name,
        source_type=source_type,
        status=SourceStatus.SYNCING,
    )
    db.add(source)
    await db.flush()

    # Ingest into Qdrant
    try:
        count = await upsert_chunks(
            chunks=chunks,
            tenant_id=str(current_user.tenant_id),
            source_id=str(source.id),
        )
        source.status = SourceStatus.ACTIVE
        source.config = {"chunk_count": count, "filename": filename}
    except Exception as e:
        source.status = SourceStatus.ERROR
        source.error_message = str(e)
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'ingestion : {e}")

    return {
        "id": str(source.id),
        "name": source.name,
        "status": source.status,
        "chunk_count": len(chunks),
    }


@router.get("")
async def list_sources(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DataSource)
        .where(DataSource.tenant_id == current_user.tenant_id)
        .order_by(DataSource.created_at.desc())
    )
    sources = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "name": s.name,
            "source_type": s.source_type,
            "status": s.status,
            "created_at": s.created_at.isoformat(),
            "error_message": s.error_message,
        }
        for s in sources
    ]


@router.delete("/{source_id}")
async def delete_source(
    source_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DataSource).where(
            DataSource.id == source_id,
            DataSource.tenant_id == current_user.tenant_id,
        )
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source introuvable")

    await db.delete(source)
    return {"ok": True}
