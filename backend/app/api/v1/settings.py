"""
CortexOS — Settings Routes
PATCH /settings/profile    → update name
PATCH /settings/password   → change password
GET   /settings/usage      → usage stats
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.core.database import get_db
from app.core.auth import get_current_user, hash_password, verify_password
from app.models.models import User, ChatSession, Message, DataSource

router = APIRouter(prefix="/settings", tags=["settings"])


class ProfileUpdate(BaseModel):
    full_name: str


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str


@router.patch("/profile")
async def update_profile(
    body: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.full_name.strip():
        raise HTTPException(status_code=400, detail="Le nom ne peut pas être vide")
    current_user.full_name = body.full_name.strip()
    return {"full_name": current_user.full_name, "message": "Profil mis à jour"}


@router.patch("/password")
async def update_password(
    body: PasswordUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.hashed_password:
        raise HTTPException(status_code=400, detail="Compte OAuth — pas de mot de passe à changer")

    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")

    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 8 caractères")

    current_user.hashed_password = hash_password(body.new_password)
    return {"message": "Mot de passe mis à jour"}


@router.get("/usage")
async def get_usage(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = current_user.tenant_id

    sessions = await db.execute(
        select(func.count()).where(ChatSession.tenant_id == tenant_id)
    )
    messages = await db.execute(
        select(func.count(Message.id))
        .join(ChatSession, Message.session_id == ChatSession.id)
        .where(ChatSession.tenant_id == tenant_id)
    )
    sources = await db.execute(
        select(func.count()).where(DataSource.tenant_id == tenant_id)
    )

    return {
        "sessions": sessions.scalar() or 0,
        "messages": messages.scalar() or 0,
        "sources": sources.scalar() or 0,
    }
