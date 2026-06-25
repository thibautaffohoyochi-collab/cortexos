"""
CortexOS — Admin Routes (Owner only)
GET /admin/stats          → global platform stats
GET /admin/tenants        → all tenants/users with usage
PATCH /admin/tenants/{id}/plan  → change subscription plan
DELETE /admin/tenants/{id}      → delete a tenant
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.config import settings
from app.models.models import (
    User, Tenant, PlanTier, ChatSession, Message,
    DataSource, Workflow, WorkflowRun
)

router = APIRouter(prefix="/admin", tags=["admin"])

# ─── Owner guard — only the OWNER email can access ───────────────────────────
OWNER_EMAIL = "thibautaffo01@gmail.com"

def require_owner(current_user: User = Depends(get_current_user)) -> User:
    if current_user.email != OWNER_EMAIL and not getattr(current_user, "is_superadmin", False):
        raise HTTPException(status_code=403, detail="Accès réservé au propriétaire de la plateforme.")
    return current_user


# ─── Schemas ──────────────────────────────────────────────────────────────────

class PlanUpdate(BaseModel):
    plan: PlanTier


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/stats")
async def platform_stats(
    owner: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    """Global platform stats for the owner dashboard."""
    now = datetime.utcnow()
    week_ago  = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    # Tenants
    total_tenants = (await db.execute(select(func.count()).select_from(Tenant))).scalar() or 0
    new_this_week = (await db.execute(
        select(func.count()).select_from(Tenant).where(Tenant.created_at >= week_ago)
    )).scalar() or 0
    new_this_month = (await db.execute(
        select(func.count()).select_from(Tenant).where(Tenant.created_at >= month_ago)
    )).scalar() or 0

    # Users
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar() or 0

    # Plans breakdown
    starter_count = (await db.execute(
        select(func.count()).select_from(Tenant).where(Tenant.plan == PlanTier.STARTER)
    )).scalar() or 0
    pro_count = (await db.execute(
        select(func.count()).select_from(Tenant).where(Tenant.plan == PlanTier.PRO)
    )).scalar() or 0
    business_count = (await db.execute(
        select(func.count()).select_from(Tenant).where(Tenant.plan == PlanTier.BUSINESS)
    )).scalar() or 0

    # Messages
    total_messages = (await db.execute(select(func.count()).select_from(Message))).scalar() or 0
    messages_this_week = (await db.execute(
        select(func.count()).select_from(Message).where(Message.created_at >= week_ago)
    )).scalar() or 0
    messages_this_month = (await db.execute(
        select(func.count()).select_from(Message).where(Message.created_at >= month_ago)
    )).scalar() or 0

    # Sessions
    total_sessions = (await db.execute(select(func.count()).select_from(ChatSession))).scalar() or 0

    # Sources
    total_sources = (await db.execute(select(func.count()).select_from(DataSource))).scalar() or 0

    # MRR estimate (rough)
    mrr = (pro_count * 29) + (business_count * 99)

    # Activity last 30 days (messages per day)
    activity = []
    for i in range(29, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count = (await db.execute(
            select(func.count()).select_from(Message)
            .where(Message.created_at >= day_start, Message.created_at < day_end)
        )).scalar() or 0
        activity.append({"date": day_start.strftime("%d/%m"), "count": count})

    # New signups last 30 days
    signups = []
    for i in range(29, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count = (await db.execute(
            select(func.count()).select_from(Tenant)
            .where(Tenant.created_at >= day_start, Tenant.created_at < day_end)
        )).scalar() or 0
        signups.append({"date": day_start.strftime("%d/%m"), "count": count})

    return {
        "overview": {
            "total_tenants": total_tenants,
            "total_users": total_users,
            "new_this_week": new_this_week,
            "new_this_month": new_this_month,
            "total_messages": total_messages,
            "messages_this_week": messages_this_week,
            "messages_this_month": messages_this_month,
            "total_sessions": total_sessions,
            "total_sources": total_sources,
            "mrr_estimate": mrr,
        },
        "plans": {
            "starter": starter_count,
            "pro": pro_count,
            "business": business_count,
        },
        "activity": activity,
        "signups": signups,
    }


@router.get("/tenants")
async def list_tenants(
    owner: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    """All tenants with their usage stats."""
    tenants_result = await db.execute(
        select(Tenant).order_by(Tenant.created_at.desc())
    )
    tenants = tenants_result.scalars().all()

    result = []
    for tenant in tenants:
        # Admin user
        admin_result = await db.execute(
            select(User).where(User.tenant_id == tenant.id, User.is_admin == True).limit(1)
        )
        admin = admin_result.scalar_one_or_none()

        # User count
        user_count = (await db.execute(
            select(func.count()).select_from(User).where(User.tenant_id == tenant.id)
        )).scalar() or 0

        # Message count
        msg_count = (await db.execute(
            select(func.count(Message.id))
            .join(ChatSession, Message.session_id == ChatSession.id)
            .where(ChatSession.tenant_id == tenant.id)
        )).scalar() or 0

        # Session count
        session_count = (await db.execute(
            select(func.count()).select_from(ChatSession)
            .where(ChatSession.tenant_id == tenant.id)
        )).scalar() or 0

        # Source count
        source_count = (await db.execute(
            select(func.count()).select_from(DataSource)
            .where(DataSource.tenant_id == tenant.id)
        )).scalar() or 0

        # Last activity
        last_msg = await db.execute(
            select(Message.created_at)
            .join(ChatSession, Message.session_id == ChatSession.id)
            .where(ChatSession.tenant_id == tenant.id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        last_activity = last_msg.scalar_one_or_none()

        result.append({
            "id": str(tenant.id),
            "name": tenant.name,
            "slug": tenant.slug,
            "plan": tenant.plan,
            "is_active": tenant.is_active,
            "created_at": tenant.created_at.isoformat(),
            "admin_email": admin.email if admin else "—",
            "admin_name": admin.full_name if admin else "—",
            "user_count": user_count,
            "session_count": session_count,
            "message_count": msg_count,
            "source_count": source_count,
            "last_activity": last_activity.isoformat() if last_activity else None,
        })

    return result


@router.patch("/tenants/{tenant_id}/plan")
async def update_plan(
    tenant_id: str,
    body: PlanUpdate,
    owner: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    """Change a tenant's subscription plan."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    tenant.plan = body.plan
    return {"ok": True, "tenant": tenant.name, "plan": body.plan}


@router.patch("/tenants/{tenant_id}/toggle")
async def toggle_tenant(
    tenant_id: str,
    owner: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    """Activate or deactivate a tenant account."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    tenant.is_active = not tenant.is_active
    return {"ok": True, "tenant": tenant.name, "is_active": tenant.is_active}


@router.delete("/tenants/{tenant_id}")
async def delete_tenant(
    tenant_id: str,
    owner: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a tenant and all their data."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    await db.delete(tenant)
    return {"ok": True, "deleted": tenant.name}
