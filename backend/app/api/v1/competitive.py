"""
CortexOS — Competitive Intelligence API
POST /competitive/competitors          → add competitor
GET  /competitive/competitors          → list competitors
DELETE /competitive/competitors/{id}   → delete competitor
POST /competitive/competitors/{id}/analyze  → scrape + analyze
POST /competitive/report               → full competitive report
GET  /competitive/competitors/{id}     → get one competitor
"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.models import User, Competitor
from app.services.competitive_service import scrape_website, analyze_competitor, generate_competitive_report

router = APIRouter(prefix="/competitive", tags=["competitive"])


class CompetitorCreate(BaseModel):
    name: str
    website: str = ""
    description: str = ""


class CompetitorUpdate(BaseModel):
    name: str | None = None
    website: str | None = None
    description: str | None = None


@router.post("/competitors", status_code=201)
async def add_competitor(
    body: CompetitorCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    competitor = Competitor(
        tenant_id=current_user.tenant_id,
        name=body.name,
        website=body.website,
        description=body.description,
    )
    db.add(competitor)
    await db.flush()
    return _to_dict(competitor)


@router.get("/competitors")
async def list_competitors(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Competitor)
        .where(Competitor.tenant_id == current_user.tenant_id)
        .order_by(Competitor.created_at.desc())
    )
    return [_to_dict(c) for c in result.scalars().all()]


@router.get("/competitors/{competitor_id}")
async def get_competitor(
    competitor_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    c = await _get_or_404(competitor_id, current_user, db)
    return _to_dict(c)


@router.delete("/competitors/{competitor_id}")
async def delete_competitor(
    competitor_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    c = await _get_or_404(competitor_id, current_user, db)
    await db.delete(c)
    return {"ok": True}


@router.post("/competitors/{competitor_id}/analyze")
async def analyze_competitor_route(
    competitor_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Scrape + analyze a competitor with Gemini."""
    c = await _get_or_404(competitor_id, current_user, db)

    if not c.website:
        raise HTTPException(status_code=400, detail="Ce concurrent n'a pas d'URL à analyser")

    # Scrape
    snapshot = await scrape_website(c.website)
    c.snapshot = snapshot
    c.last_scraped_at = datetime.utcnow()

    # Analyze
    analysis = await analyze_competitor(
        competitor_name=c.name,
        snapshot=snapshot,
        my_profile=f"Je suis {current_user.full_name}, dans le même secteur.",
    )
    c.last_analysis = analysis
    c.updated_at = datetime.utcnow()

    return {**_to_dict(c), "analysis": analysis}


@router.post("/report")
async def generate_report(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a full competitive intelligence report."""
    result = await db.execute(
        select(Competitor)
        .where(Competitor.tenant_id == current_user.tenant_id)
    )
    competitors = result.scalars().all()

    if not competitors:
        raise HTTPException(status_code=400, detail="Ajoutez d'abord des concurrents")

    report = await generate_competitive_report(
        competitors_data=[_to_dict(c) for c in competitors],
        my_profile=f"{current_user.full_name} — {current_user.email}",
    )
    return {"report": report, "competitors_count": len(competitors)}


async def _get_or_404(cid: uuid.UUID, user: User, db: AsyncSession) -> Competitor:
    result = await db.execute(
        select(Competitor).where(
            Competitor.id == cid,
            Competitor.tenant_id == user.tenant_id,
        )
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Concurrent introuvable")
    return c


def _to_dict(c: Competitor) -> dict:
    return {
        "id": str(c.id),
        "name": c.name,
        "website": c.website,
        "description": c.description,
        "last_scraped_at": c.last_scraped_at.isoformat() if c.last_scraped_at else None,
        "last_analysis": c.last_analysis,
        "snapshot": c.snapshot,
        "created_at": c.created_at.isoformat(),
        "updated_at": c.updated_at.isoformat(),
    }
