"""
CortexOS — Team Management Routes
POST /team/invite      → invite a user by email (admin only)
GET  /team/members     → list all members of the tenant
DELETE /team/members/{id} → remove a member (admin only)
POST /team/join/{token}   → join a tenant via invite token
"""
import uuid
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.core.auth import get_current_user, get_current_admin, hash_password, create_access_token, create_refresh_token
from app.models.models import User, Tenant
from app.services.email_service import send_invite_email

router = APIRouter(prefix="/team", tags=["team"])

# In-memory invite store (good enough for MVP — use Redis/DB in production)
_invites: dict[str, dict] = {}


class InviteRequest(BaseModel):
    email: EmailStr
    full_name: str = ""


class JoinRequest(BaseModel):
    full_name: str
    password: str


class MemberResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    is_admin: bool
    created_at: str

    model_config = {"from_attributes": True}


@router.post("/invite")
async def invite_member(
    body: InviteRequest,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")

    # Generate invite token
    token = secrets.token_urlsafe(32)
    _invites[token] = {
        "email": body.email,
        "full_name": body.full_name,
        "tenant_id": str(current_user.tenant_id),
        "invited_by": str(current_user.id),
        "expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
    }

    # Get tenant name
    result = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    tenant = result.scalar_one()

    invite_url = f"https://cortexos-xi.vercel.app/join/{token}"

    # Send invitation email
    email_sent = await send_invite_email(
        to_email=body.email,
        invite_url=invite_url,
        tenant_name=tenant.name,
        invited_by_name=current_user.full_name or current_user.email,
    )

    return {
        "invite_url": invite_url,
        "email": body.email,
        "email_sent": email_sent,
        "expires_in": "7 jours",
        "tenant_name": tenant.name,
        "message": f"{'Email envoyé à' if email_sent else 'Partagez ce lien avec'} {body.email} : {invite_url}",
    }


@router.get("/invite/{token}")
async def get_invite_info(token: str):
    """Get invite details before joining."""
    invite = _invites.get(token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invitation invalide ou expirée")

    expires = datetime.fromisoformat(invite["expires_at"])
    if datetime.utcnow() > expires:
        del _invites[token]
        raise HTTPException(status_code=410, detail="Invitation expirée")

    return {
        "email": invite["email"],
        "full_name": invite["full_name"],
        "tenant_id": invite["tenant_id"],
    }


@router.post("/join/{token}")
async def join_team(
    token: str,
    body: JoinRequest,
    db: AsyncSession = Depends(get_db),
):
    """Accept an invitation and create account."""
    invite = _invites.get(token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invitation invalide ou expirée")

    expires = datetime.fromisoformat(invite["expires_at"])
    if datetime.utcnow() > expires:
        del _invites[token]
        raise HTTPException(status_code=410, detail="Invitation expirée")

    # Check email not taken
    result = await db.execute(select(User).where(User.email == invite["email"]))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")

    # Create user in the same tenant
    user = User(
        tenant_id=uuid.UUID(invite["tenant_id"]),
        email=invite["email"],
        hashed_password=hash_password(body.password),
        full_name=body.full_name or invite["full_name"],
        is_admin=False,
    )
    db.add(user)
    await db.flush()

    # Remove used invite
    del _invites[token]

    token_data = {"sub": str(user.id), "tenant_id": str(user.tenant_id)}
    return {
        "access_token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "token_type": "bearer",
    }


@router.patch("/members/{member_id}/promote")
async def promote_member(
    member_id: uuid.UUID,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Toggle admin status for a member."""
    if member_id == current_user.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas modifier votre propre rôle")

    result = await db.execute(
        select(User).where(
            User.id == member_id,
            User.tenant_id == current_user.tenant_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Membre introuvable")

    member.is_admin = not member.is_admin
    return {
        "id": str(member.id),
        "is_admin": member.is_admin,
        "message": f"{'Promu admin' if member.is_admin else 'Rétrogradé membre'} avec succès",
    }


@router.get("/pending-invites")
async def list_pending_invites(
    current_user: User = Depends(get_current_admin),
):
    """List pending invitations for this tenant."""
    tenant_id = str(current_user.tenant_id)
    now = datetime.utcnow()
    pending = [
        {
            "email": inv["email"],
            "full_name": inv["full_name"],
            "expires_at": inv["expires_at"],
            "expired": datetime.fromisoformat(inv["expires_at"]) < now,
        }
        for inv in _invites.values()
        if inv["tenant_id"] == tenant_id
    ]
    return pending
async def list_members(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User)
        .where(User.tenant_id == current_user.tenant_id)
        .order_by(User.created_at.asc())
    )
    members = result.scalars().all()
    return [
        MemberResponse(
            id=m.id,
            email=m.email,
            full_name=m.full_name,
            is_admin=m.is_admin,
            created_at=m.created_at.isoformat(),
        )
        for m in members
    ]


@router.delete("/members/{member_id}")
async def remove_member(
    member_id: uuid.UUID,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    if member_id == current_user.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous supprimer vous-même")

    result = await db.execute(
        select(User).where(
            User.id == member_id,
            User.tenant_id == current_user.tenant_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Membre introuvable")

    await db.delete(member)
    return {"ok": True}
