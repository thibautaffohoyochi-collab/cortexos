"""
CortexOS — Workflows API
POST /workflows          → create workflow
GET  /workflows          → list workflows
GET  /workflows/{id}     → get workflow details
PUT  /workflows/{id}     → update workflow
DELETE /workflows/{id}   → delete workflow
POST /workflows/{id}/run → execute workflow
GET  /workflows/{id}/runs → list runs
GET  /workflows/runs/{run_id} → get run details
"""
import uuid
import asyncio
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Any

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.models import User, Workflow, WorkflowRun, WorkflowStatus
from app.services.workflow_engine import run_workflow

router = APIRouter(prefix="/workflows", tags=["workflows"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class StepSchema(BaseModel):
    name: str
    type: str  # search_sources | ask_ai | summarize | send_email | save_to_chat
    config: dict[str, Any] = {}


class WorkflowCreate(BaseModel):
    name: str
    description: str = ""
    steps: list[StepSchema]
    schedule: str | None = None  # cron: "0 9 * * 1" = every monday 9am


class WorkflowUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    steps: list[StepSchema] | None = None
    schedule: str | None = None
    is_active: bool | None = None


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("", status_code=201)
async def create_workflow(
    body: WorkflowCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.steps:
        raise HTTPException(status_code=400, detail="Un workflow doit avoir au moins une étape")

    workflow = Workflow(
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        name=body.name,
        description=body.description,
        steps=[s.model_dump() for s in body.steps],
        schedule=body.schedule,
    )
    db.add(workflow)
    await db.flush()
    return _workflow_to_dict(workflow)


@router.get("")
async def list_workflows(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Workflow)
        .where(Workflow.tenant_id == current_user.tenant_id)
        .order_by(Workflow.created_at.desc())
    )
    return [_workflow_to_dict(w) for w in result.scalars().all()]


@router.get("/runs/{run_id}")
async def get_run(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkflowRun).where(
            WorkflowRun.id == run_id,
            WorkflowRun.tenant_id == current_user.tenant_id,
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Exécution introuvable")
    return _run_to_dict(run)


@router.get("/{workflow_id}")
async def get_workflow(
    workflow_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workflow = await _get_workflow(workflow_id, current_user, db)
    return _workflow_to_dict(workflow)


@router.put("/{workflow_id}")
async def update_workflow(
    workflow_id: uuid.UUID,
    body: WorkflowUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workflow = await _get_workflow(workflow_id, current_user, db)
    if body.name is not None: workflow.name = body.name
    if body.description is not None: workflow.description = body.description
    if body.steps is not None: workflow.steps = [s.model_dump() for s in body.steps]
    if body.schedule is not None: workflow.schedule = body.schedule
    if body.is_active is not None: workflow.is_active = body.is_active
    workflow.updated_at = datetime.utcnow()
    return _workflow_to_dict(workflow)


@router.delete("/{workflow_id}")
async def delete_workflow(
    workflow_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workflow = await _get_workflow(workflow_id, current_user, db)
    await db.delete(workflow)
    return {"ok": True}


@router.post("/{workflow_id}/run")
async def run_workflow_now(
    workflow_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workflow = await _get_workflow(workflow_id, current_user, db)

    if not workflow.steps:
        raise HTTPException(status_code=400, detail="Ce workflow n'a pas d'étapes")

    # Create run record
    run = WorkflowRun(
        workflow_id=workflow.id,
        tenant_id=current_user.tenant_id,
        status=WorkflowStatus.IDLE,
    )
    db.add(run)
    await db.flush()
    run_id = run.id

    # Execute in background
    background_tasks.add_task(
        _execute_workflow_background,
        run_id=str(run_id),
        steps=workflow.steps,
        tenant_id=str(current_user.tenant_id),
        user_id=str(current_user.id),
    )

    return {
        "run_id": str(run_id),
        "status": "running",
        "message": "Workflow lancé en arrière-plan",
    }


@router.get("/{workflow_id}/runs")
async def list_runs(
    workflow_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_workflow(workflow_id, current_user, db)
    result = await db.execute(
        select(WorkflowRun)
        .where(WorkflowRun.workflow_id == workflow_id)
        .order_by(WorkflowRun.started_at.desc())
        .limit(20)
    )
    return [_run_to_dict(r) for r in result.scalars().all()]


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _get_workflow(workflow_id: uuid.UUID, user: User, db: AsyncSession) -> Workflow:
    result = await db.execute(
        select(Workflow).where(
            Workflow.id == workflow_id,
            Workflow.tenant_id == user.tenant_id,
        )
    )
    w = result.scalar_one_or_none()
    if not w:
        raise HTTPException(status_code=404, detail="Workflow introuvable")
    return w


async def _execute_workflow_background(run_id: str, steps: list, tenant_id: str, user_id: str):
    """Run workflow in background with its own DB session."""
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(WorkflowRun).where(WorkflowRun.id == uuid.UUID(run_id)))
        run = result.scalar_one_or_none()
        if not run:
            return
        try:
            await run_workflow(run, steps, tenant_id, user_id, db)
            await db.commit()
        except Exception as e:
            run.status = WorkflowStatus.FAILED
            run.error = str(e)
            run.completed_at = datetime.utcnow()
            await db.commit()


def _workflow_to_dict(w: Workflow) -> dict:
    return {
        "id": str(w.id),
        "name": w.name,
        "description": w.description,
        "steps": w.steps,
        "schedule": w.schedule,
        "is_active": w.is_active,
        "created_at": w.created_at.isoformat(),
        "updated_at": w.updated_at.isoformat(),
    }


def _run_to_dict(r: WorkflowRun) -> dict:
    return {
        "id": str(r.id),
        "workflow_id": str(r.workflow_id),
        "status": r.status,
        "steps_results": r.steps_results,
        "final_output": r.final_output,
        "error": r.error,
        "started_at": r.started_at.isoformat(),
        "completed_at": r.completed_at.isoformat() if r.completed_at else None,
    }
