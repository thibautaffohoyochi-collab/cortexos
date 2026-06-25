"""
CortexOS — Plan Limits & Enforcement
Centralizes all quota logic. Import check_limit() wherever you need enforcement.
"""
from datetime import datetime, timedelta
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.models import (
    PlanTier, Tenant, User,
    ChatSession, Message, DataSource, Workflow, WorkflowRun,
)


# ─── Plan definitions ─────────────────────────────────────────────────────────

PLANS: dict[str, dict] = {
    PlanTier.STARTER: {
        "label":            "Starter",
        "price":            0,
        "messages_per_month": 500,
        "sources_max":      3,
        "workflows_max":    1,
        "team_members_max": 1,       # just the owner
        "web_search":       False,
        "api_access":       False,
        "competitive":      False,
    },
    PlanTier.PRO: {
        "label":            "Pro",
        "price":            29,
        "messages_per_month": 5000,
        "sources_max":      -1,      # unlimited
        "workflows_max":    10,
        "team_members_max": 10,
        "web_search":       True,
        "api_access":       True,
        "competitive":      True,
    },
    PlanTier.BUSINESS: {
        "label":            "Business",
        "price":            99,
        "messages_per_month": -1,    # unlimited
        "sources_max":      -1,
        "workflows_max":    -1,
        "team_members_max": -1,
        "web_search":       True,
        "api_access":       True,
        "competitive":      True,
    },
}

# Helper — upgrade CTA message
UPGRADE_MSG = "🔒 Limite atteinte. Passez au plan Pro sur /settings pour continuer."
UPGRADE_PRO_MSG = "🔒 Fonctionnalité réservée au plan Pro. Passez au plan Pro sur /settings."


async def _get_tenant(db: AsyncSession, tenant_id) -> Tenant:
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Workspace introuvable")
    if not tenant.is_active:
        raise HTTPException(status_code=403, detail="Votre compte a été suspendu. Contactez le support.")
    return tenant


def get_plan(tenant: Tenant) -> dict:
    return PLANS.get(tenant.plan, PLANS[PlanTier.STARTER])


# ─── Individual checks ────────────────────────────────────────────────────────

async def check_message_limit(db: AsyncSession, tenant_id, tenant: Tenant | None = None):
    """Raise 429 if the tenant has exceeded their monthly message quota."""
    if tenant is None:
        tenant = await _get_tenant(db, tenant_id)
    plan = get_plan(tenant)
    limit = plan["messages_per_month"]
    if limit == -1:
        return  # unlimited

    month_ago = datetime.utcnow() - timedelta(days=30)
    count = (await db.execute(
        select(func.count(Message.id))
        .join(ChatSession, Message.session_id == ChatSession.id)
        .where(
            ChatSession.tenant_id == tenant_id,
            Message.role == "user",
            Message.created_at >= month_ago,
        )
    )).scalar() or 0

    if count >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"🔒 Limite de {limit} messages/mois atteinte ({count}/{limit}). {UPGRADE_MSG}",
            headers={"X-Plan": tenant.plan, "X-Limit": str(limit), "X-Used": str(count)},
        )


async def check_source_limit(db: AsyncSession, tenant_id, tenant: Tenant | None = None):
    """Raise 403 if the tenant has reached their max data sources."""
    if tenant is None:
        tenant = await _get_tenant(db, tenant_id)
    plan = get_plan(tenant)
    limit = plan["sources_max"]
    if limit == -1:
        return  # unlimited

    count = (await db.execute(
        select(func.count()).select_from(DataSource)
        .where(DataSource.tenant_id == tenant_id)
    )).scalar() or 0

    if count >= limit:
        raise HTTPException(
            status_code=403,
            detail=f"🔒 Limite de {limit} source(s) atteinte ({count}/{limit}). {UPGRADE_MSG}",
            headers={"X-Plan": tenant.plan, "X-Limit": str(limit), "X-Used": str(count)},
        )


async def check_workflow_limit(db: AsyncSession, tenant_id, tenant: Tenant | None = None):
    """Raise 403 if the tenant has reached their max workflows."""
    if tenant is None:
        tenant = await _get_tenant(db, tenant_id)
    plan = get_plan(tenant)
    limit = plan["workflows_max"]
    if limit == -1:
        return  # unlimited

    count = (await db.execute(
        select(func.count()).select_from(Workflow)
        .where(Workflow.tenant_id == tenant_id)
    )).scalar() or 0

    if count >= limit:
        raise HTTPException(
            status_code=403,
            detail=f"🔒 Limite de {limit} workflow(s) atteinte ({count}/{limit}). {UPGRADE_MSG}",
            headers={"X-Plan": tenant.plan, "X-Limit": str(limit), "X-Used": str(count)},
        )


async def check_team_limit(db: AsyncSession, tenant_id, tenant: Tenant | None = None):
    """Raise 403 if the tenant has reached their max team members."""
    if tenant is None:
        tenant = await _get_tenant(db, tenant_id)
    plan = get_plan(tenant)
    limit = plan["team_members_max"]
    if limit == -1:
        return  # unlimited

    count = (await db.execute(
        select(func.count()).select_from(User)
        .where(User.tenant_id == tenant_id)
    )).scalar() or 0

    if count >= limit:
        raise HTTPException(
            status_code=403,
            detail=f"🔒 Limite de {limit} membre(s) atteinte ({count}/{limit}). {UPGRADE_MSG}",
            headers={"X-Plan": tenant.plan, "X-Limit": str(limit), "X-Used": str(count)},
        )


def check_web_search(tenant: Tenant):
    """Raise 403 if the plan does not include web search."""
    plan = get_plan(tenant)
    if not plan["web_search"]:
        raise HTTPException(
            status_code=403,
            detail=f"🔒 La recherche web est réservée au plan Pro. {UPGRADE_PRO_MSG}",
        )


def check_competitive(tenant: Tenant):
    """Raise 403 if the plan does not include competitive intelligence."""
    plan = get_plan(tenant)
    if not plan["competitive"]:
        raise HTTPException(
            status_code=403,
            detail=f"🔒 La veille concurrentielle est réservée au plan Pro. {UPGRADE_PRO_MSG}",
        )


# ─── Usage summary (for settings/dashboard) ──────────────────────────────────

async def get_usage_summary(db: AsyncSession, tenant_id, user_id=None) -> dict:
    """Return current usage vs limits for a tenant."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        return {}

    plan = get_plan(tenant)
    month_ago = datetime.utcnow() - timedelta(days=30)

    msg_count = (await db.execute(
        select(func.count(Message.id))
        .join(ChatSession, Message.session_id == ChatSession.id)
        .where(
            ChatSession.tenant_id == tenant_id,
            Message.role == "user",
            Message.created_at >= month_ago,
        )
    )).scalar() or 0

    source_count = (await db.execute(
        select(func.count()).select_from(DataSource)
        .where(DataSource.tenant_id == tenant_id)
    )).scalar() or 0

    workflow_count = (await db.execute(
        select(func.count()).select_from(Workflow)
        .where(Workflow.tenant_id == tenant_id)
    )).scalar() or 0

    member_count = (await db.execute(
        select(func.count()).select_from(User)
        .where(User.tenant_id == tenant_id)
    )).scalar() or 0

    def pct(used, limit):
        if limit == -1:
            return 0
        return min(round((used / limit) * 100), 100) if limit > 0 else 100

    def fmt(limit):
        return "∞" if limit == -1 else str(limit)

    return {
        "plan":        tenant.plan,
        "plan_label":  plan["label"],
        "plan_price":  plan["price"],
        "features": {
            "web_search":  plan["web_search"],
            "api_access":  plan["api_access"],
            "competitive": plan["competitive"],
        },
        "usage": {
            "messages": {
                "used":    msg_count,
                "limit":   plan["messages_per_month"],
                "limit_display": fmt(plan["messages_per_month"]),
                "pct":     pct(msg_count, plan["messages_per_month"]),
                "period":  "30 derniers jours",
            },
            "sources": {
                "used":    source_count,
                "limit":   plan["sources_max"],
                "limit_display": fmt(plan["sources_max"]),
                "pct":     pct(source_count, plan["sources_max"]),
            },
            "workflows": {
                "used":    workflow_count,
                "limit":   plan["workflows_max"],
                "limit_display": fmt(plan["workflows_max"]),
                "pct":     pct(workflow_count, plan["workflows_max"]),
            },
            "members": {
                "used":    member_count,
                "limit":   plan["team_members_max"],
                "limit_display": fmt(plan["team_members_max"]),
                "pct":     pct(member_count, plan["team_members_max"]),
            },
        },
    }
