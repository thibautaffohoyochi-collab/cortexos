"""
CortexOS — Google OAuth Routes
GET  /google/auth-url        → get Google OAuth URL
GET  /google/callback         → handle OAuth callback, save tokens
POST /google/sync/gmail       → fetch Gmail and ingest into Qdrant
POST /google/sync/drive       → fetch Drive files and ingest into Qdrant
GET  /google/status           → check if Google is connected
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from urllib.parse import urlencode
import os

from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.config import settings
from app.models.models import User, DataSource, SourceType, SourceStatus
from app.services.google_service import (
    exchange_code_for_tokens, refresh_access_token,
    fetch_gmail_messages, fetch_drive_files
)
from app.services.qdrant_service import upsert_chunks, chunk_text

router = APIRouter(prefix="/google", tags=["google"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://cortexos-xi.vercel.app")
REDIRECT_URI = f"{FRONTEND_URL}/api/auth/google/callback"

GMAIL_SCOPES = [
    "openid", "email", "profile",
    "https://www.googleapis.com/auth/gmail.readonly",
]
DRIVE_SCOPES = [
    "openid", "email", "profile",
    "https://www.googleapis.com/auth/drive.readonly",
]


@router.get("/auth-url")
async def get_auth_url(
    source: str = Query(default="gmail"),  # "gmail" or "drive"
    current_user: User = Depends(get_current_user),
):
    scopes = GMAIL_SCOPES if source == "gmail" else DRIVE_SCOPES
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(scopes),
        "access_type": "offline",
        "prompt": "consent",
        "state": f"{source}:{current_user.id}",
    }
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    return {"url": url}


@router.get("/callback")
async def google_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Handle OAuth callback — exchange code for tokens."""
    try:
        source_type, user_id = state.split(":", 1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid state")

    tokens = await exchange_code_for_tokens(code, REDIRECT_URI)

    # Save tokens to user
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.google_access_token = tokens.get("access_token")
    user.google_refresh_token = tokens.get("refresh_token", user.google_refresh_token)

    # Redirect back to frontend
    return RedirectResponse(url=f"{FRONTEND_URL}/sources?google_connected={source_type}")


@router.get("/status")
async def google_status(current_user: User = Depends(get_current_user)):
    return {
        "connected": bool(current_user.google_access_token),
    }


@router.post("/sync/gmail")
async def sync_gmail(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.google_access_token:
        raise HTTPException(status_code=400, detail="Google non connecté. Connectez Gmail d'abord.")

    # Refresh token if needed
    try:
        access_token = current_user.google_access_token
        messages = await fetch_gmail_messages(access_token, max_results=50)
    except Exception:
        if current_user.google_refresh_token:
            access_token = await refresh_access_token(current_user.google_refresh_token)
            current_user.google_access_token = access_token
            messages = await fetch_gmail_messages(access_token, max_results=50)
        else:
            raise HTTPException(status_code=401, detail="Token Google expiré. Reconnectez Gmail.")

    if not messages:
        return {"message": "Aucun email trouvé", "chunk_count": 0}

    # Convert messages to chunks
    chunks = []
    for msg in messages:
        text = f"Email de: {msg['from']}\nDate: {msg['date']}\nSujet: {msg['subject']}\nRésumé: {msg['snippet']}"
        sub_chunks = chunk_text(text, chunk_size=200, overlap=20)
        for i, c in enumerate(sub_chunks):
            chunks.append({"text": c, "title": f"Gmail - {msg['subject'][:50]}", "index": i})

    # Create or update DataSource
    result = await db.execute(
        select(DataSource).where(
            DataSource.tenant_id == current_user.tenant_id,
            DataSource.source_type == SourceType.GMAIL,
        )
    )
    source = result.scalar_one_or_none()
    if not source:
        source = DataSource(
            tenant_id=current_user.tenant_id,
            name="Gmail",
            source_type=SourceType.GMAIL,
            status=SourceStatus.SYNCING,
        )
        db.add(source)
        await db.flush()

    # Ingest into Qdrant
    count = await upsert_chunks(
        chunks=chunks,
        tenant_id=str(current_user.tenant_id),
        source_id=str(source.id),
    )
    source.status = SourceStatus.ACTIVE
    source.config = {"chunk_count": count, "email_count": len(messages)}

    return {
        "message": f"{len(messages)} emails importés",
        "chunk_count": count,
    }


@router.post("/sync/drive")
async def sync_drive(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.google_access_token:
        raise HTTPException(status_code=400, detail="Google non connecté.")

    try:
        access_token = current_user.google_access_token
        files = await fetch_drive_files(access_token, max_results=30)
    except Exception:
        if current_user.google_refresh_token:
            access_token = await refresh_access_token(current_user.google_refresh_token)
            current_user.google_access_token = access_token
            files = await fetch_drive_files(access_token, max_results=30)
        else:
            raise HTTPException(status_code=401, detail="Token Google expiré.")

    if not files:
        return {"message": "Aucun fichier trouvé", "chunk_count": 0}

    chunks = []
    for f in files:
        text = f"Fichier Drive: {f['name']}\nType: {f.get('mimeType', '')}\nModifié: {f.get('modifiedTime', '')}"
        chunks.append({"text": text, "title": f"Drive - {f['name'][:50]}", "index": 0})

    result = await db.execute(
        select(DataSource).where(
            DataSource.tenant_id == current_user.tenant_id,
            DataSource.source_type == SourceType.GOOGLE_DRIVE,
        )
    )
    source = result.scalar_one_or_none()
    if not source:
        source = DataSource(
            tenant_id=current_user.tenant_id,
            name="Google Drive",
            source_type=SourceType.GOOGLE_DRIVE,
            status=SourceStatus.SYNCING,
        )
        db.add(source)
        await db.flush()

    count = await upsert_chunks(
        chunks=chunks,
        tenant_id=str(current_user.tenant_id),
        source_id=str(source.id),
    )
    source.status = SourceStatus.ACTIVE
    source.config = {"chunk_count": count, "file_count": len(files)}

    return {
        "message": f"{len(files)} fichiers Drive importés",
        "chunk_count": count,
    }
