"""
CortexOS — Dashboard Routes
GET /dashboard/stats → stats for the current tenant
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.models import User, ChatSession, Message, DataSource

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = current_user.tenant_id

    # Total sessions
    sessions_result = await db.execute(
        select(func.count()).where(ChatSession.tenant_id == tenant_id)
    )
    total_sessions = sessions_result.scalar() or 0

    # Total messages
    messages_result = await db.execute(
        select(func.count(Message.id))
        .join(ChatSession, Message.session_id == ChatSession.id)
        .where(ChatSession.tenant_id == tenant_id)
    )
    total_messages = messages_result.scalar() or 0

    # Total data sources
    sources_result = await db.execute(
        select(func.count()).where(DataSource.tenant_id == tenant_id)
    )
    total_sources = sources_result.scalar() or 0

    # Recent sessions (last 5)
    recent_result = await db.execute(
        select(ChatSession)
        .where(ChatSession.tenant_id == tenant_id)
        .order_by(ChatSession.created_at.desc())
        .limit(5)
    )
    recent_sessions = recent_result.scalars().all()

    return {
        "stats": {
            "total_sessions": total_sessions,
            "total_messages": total_messages,
            "total_sources": total_sources,
            "tenant_name": current_user.tenant.name if hasattr(current_user, 'tenant') else "",
        },
        "recent_sessions": [
            {
                "id": str(s.id),
                "title": s.title,
                "created_at": s.created_at.isoformat(),
            }
            for s in recent_sessions
        ],
    }
