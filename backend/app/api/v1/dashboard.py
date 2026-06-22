"""
CortexOS — Dashboard Routes
GET /dashboard/stats → comprehensive stats for the current tenant
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.models import (
    User, ChatSession, Message, DataSource, SourceStatus,
    Workflow, WorkflowRun, WorkflowStatus, Competitor
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = current_user.tenant_id
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    # ── Chat stats ────────────────────────────────────────────────────────────
    total_sessions = (await db.execute(
        select(func.count()).select_from(ChatSession)
        .where(ChatSession.tenant_id == tenant_id)
    )).scalar() or 0

    sessions_this_week = (await db.execute(
        select(func.count()).select_from(ChatSession)
        .where(ChatSession.tenant_id == tenant_id, ChatSession.created_at >= week_ago)
    )).scalar() or 0

    total_messages = (await db.execute(
        select(func.count(Message.id))
        .join(ChatSession, Message.session_id == ChatSession.id)
        .where(ChatSession.tenant_id == tenant_id)
    )).scalar() or 0

    messages_this_week = (await db.execute(
        select(func.count(Message.id))
        .join(ChatSession, Message.session_id == ChatSession.id)
        .where(ChatSession.tenant_id == tenant_id, Message.created_at >= week_ago)
    )).scalar() or 0

    # ── Sources stats ─────────────────────────────────────────────────────────
    total_sources = (await db.execute(
        select(func.count()).select_from(DataSource)
        .where(DataSource.tenant_id == tenant_id)
    )).scalar() or 0

    active_sources = (await db.execute(
        select(func.count()).select_from(DataSource)
        .where(DataSource.tenant_id == tenant_id, DataSource.status == SourceStatus.ACTIVE)
    )).scalar() or 0

    # ── Workflow stats ────────────────────────────────────────────────────────
    total_workflows = (await db.execute(
        select(func.count()).select_from(Workflow)
        .where(Workflow.tenant_id == tenant_id)
    )).scalar() or 0

    total_runs = (await db.execute(
        select(func.count()).select_from(WorkflowRun)
        .where(WorkflowRun.tenant_id == tenant_id)
    )).scalar() or 0

    successful_runs = (await db.execute(
        select(func.count()).select_from(WorkflowRun)
        .where(WorkflowRun.tenant_id == tenant_id, WorkflowRun.status == WorkflowStatus.COMPLETED)
    )).scalar() or 0

    runs_this_week = (await db.execute(
        select(func.count()).select_from(WorkflowRun)
        .where(WorkflowRun.tenant_id == tenant_id, WorkflowRun.started_at >= week_ago)
    )).scalar() or 0

    # ── Competitor stats ──────────────────────────────────────────────────────
    total_competitors = (await db.execute(
        select(func.count()).select_from(Competitor)
        .where(Competitor.tenant_id == tenant_id)
    )).scalar() or 0

    # ── Activity last 7 days (messages per day) ───────────────────────────────
    activity = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count = (await db.execute(
            select(func.count(Message.id))
            .join(ChatSession, Message.session_id == ChatSession.id)
            .where(
                ChatSession.tenant_id == tenant_id,
                Message.created_at >= day_start,
                Message.created_at < day_end,
            )
        )).scalar() or 0
        activity.append({
            "date": day_start.strftime("%d/%m"),
            "messages": count,
        })

    # ── Recent sessions ───────────────────────────────────────────────────────
    recent_sessions_result = await db.execute(
        select(ChatSession)
        .where(ChatSession.tenant_id == tenant_id)
        .order_by(ChatSession.created_at.desc())
        .limit(5)
    )
    recent_sessions = recent_sessions_result.scalars().all()

    # ── Recent workflow runs ──────────────────────────────────────────────────
    recent_runs_result = await db.execute(
        select(WorkflowRun, Workflow.name)
        .join(Workflow, WorkflowRun.workflow_id == Workflow.id)
        .where(WorkflowRun.tenant_id == tenant_id)
        .order_by(WorkflowRun.started_at.desc())
        .limit(4)
    )
    recent_runs = recent_runs_result.all()

    # ── Sources list (active ones) ────────────────────────────────────────────
    sources_result = await db.execute(
        select(DataSource)
        .where(DataSource.tenant_id == tenant_id)
        .order_by(DataSource.created_at.desc())
        .limit(6)
    )
    sources_list = sources_result.scalars().all()

    # ── Tenant name ───────────────────────────────────────────────────────────
    tenant_name = ""
    try:
        from app.models.models import Tenant
        t_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = t_result.scalar_one_or_none()
        if tenant:
            tenant_name = tenant.name
    except Exception:
        pass

    return {
        "stats": {
            "total_sessions": total_sessions,
            "sessions_this_week": sessions_this_week,
            "total_messages": total_messages,
            "messages_this_week": messages_this_week,
            "total_sources": total_sources,
            "active_sources": active_sources,
            "total_workflows": total_workflows,
            "total_runs": total_runs,
            "successful_runs": successful_runs,
            "runs_this_week": runs_this_week,
            "total_competitors": total_competitors,
            "tenant_name": tenant_name,
            "user_name": current_user.full_name or current_user.email.split("@")[0],
        },
        "activity": activity,
        "recent_sessions": [
            {
                "id": str(s.id),
                "title": s.title,
                "created_at": s.created_at.isoformat(),
            }
            for s in recent_sessions
        ],
        "recent_runs": [
            {
                "id": str(run.id),
                "workflow_name": wf_name,
                "status": run.status,
                "started_at": run.started_at.isoformat(),
            }
            for run, wf_name in recent_runs
        ],
        "sources": [
            {
                "id": str(s.id),
                "name": s.name,
                "source_type": s.source_type,
                "status": s.status,
                "format": (s.config or {}).get("format", ""),
            }
            for s in sources_list
        ],
    }
