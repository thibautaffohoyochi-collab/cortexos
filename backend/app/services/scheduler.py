"""
CortexOS — Workflow Scheduler
Uses APScheduler to run cron-based workflows automatically.
Loads all active scheduled workflows from DB on startup,
and re-syncs when workflows are created/updated/deleted.
"""
import uuid
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

# Global scheduler instance
scheduler = AsyncIOScheduler(timezone="UTC")


def get_scheduler() -> AsyncIOScheduler:
    return scheduler


async def _execute_scheduled_workflow(workflow_id: str, tenant_id: str):
    """Called by APScheduler — runs a workflow with its own DB session."""
    print(f"[Scheduler] Running workflow {workflow_id} for tenant {tenant_id}")
    from app.core.database import AsyncSessionLocal
    from app.models.models import Workflow, WorkflowRun, WorkflowStatus
    from app.services.workflow_engine import run_workflow

    async with AsyncSessionLocal() as db:
        # Load workflow
        result = await db.execute(
            select(Workflow).where(Workflow.id == uuid.UUID(workflow_id))
        )
        workflow = result.scalar_one_or_none()
        if not workflow or not workflow.is_active:
            print(f"[Scheduler] Workflow {workflow_id} not found or inactive — skipping")
            return

        # Create run record
        run = WorkflowRun(
            workflow_id=workflow.id,
            tenant_id=workflow.tenant_id,
            status=WorkflowStatus.IDLE,
        )
        db.add(run)
        await db.flush()

        # Find a user in the tenant to associate the run with
        from app.models.models import User
        user_result = await db.execute(
            select(User).where(
                User.tenant_id == workflow.tenant_id,
                User.is_active == True,
            ).limit(1)
        )
        user = user_result.scalar_one_or_none()
        user_id = str(user.id) if user else str(uuid.uuid4())

        try:
            await run_workflow(run, workflow.steps, str(workflow.tenant_id), user_id, db)
            await db.commit()
            print(f"[Scheduler] Workflow {workflow.name} completed — status: {run.status}")
        except Exception as e:
            run.status = WorkflowStatus.FAILED
            run.error = str(e)
            run.completed_at = datetime.utcnow()
            await db.commit()
            print(f"[Scheduler] Workflow {workflow.name} failed: {e}")


def schedule_workflow(workflow_id: str, tenant_id: str, cron_expr: str) -> bool:
    """
    Add or replace a workflow's cron job.
    cron_expr: standard 5-field cron string e.g. "0 9 * * 1"
    Returns True if scheduled, False if cron is invalid.
    """
    job_id = f"workflow_{workflow_id}"

    try:
        # Parse cron — validate it
        parts = cron_expr.strip().split()
        if len(parts) != 5:
            raise ValueError(f"Cron must have 5 fields, got {len(parts)}: '{cron_expr}'")

        minute, hour, day, month, day_of_week = parts
        trigger = CronTrigger(
            minute=minute,
            hour=hour,
            day=day,
            month=month,
            day_of_week=day_of_week,
            timezone="UTC",
        )

        # Remove existing job if any
        if scheduler.get_job(job_id):
            scheduler.remove_job(job_id)

        scheduler.add_job(
            _execute_scheduled_workflow,
            trigger=trigger,
            id=job_id,
            args=[workflow_id, tenant_id],
            replace_existing=True,
            misfire_grace_time=300,  # allow 5 min late execution
        )
        print(f"[Scheduler] Scheduled workflow {workflow_id} with cron: {cron_expr}")
        return True

    except Exception as e:
        print(f"[Scheduler] Failed to schedule workflow {workflow_id}: {e}")
        return False


def unschedule_workflow(workflow_id: str):
    """Remove a workflow's cron job."""
    job_id = f"workflow_{workflow_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
        print(f"[Scheduler] Removed schedule for workflow {workflow_id}")


async def load_all_scheduled_workflows():
    """
    Called on startup — loads all active workflows with a schedule from DB.
    """
    from app.core.database import AsyncSessionLocal
    from app.models.models import Workflow

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Workflow).where(
                    Workflow.schedule.isnot(None),
                    Workflow.is_active == True,
                )
            )
            workflows = result.scalars().all()

            count = 0
            for wf in workflows:
                if wf.schedule and schedule_workflow(str(wf.id), str(wf.tenant_id), wf.schedule):
                    count += 1

            print(f"[Scheduler] Loaded {count} scheduled workflow(s) from DB")
    except Exception as e:
        print(f"[Scheduler] Failed to load workflows from DB: {e}")


def list_scheduled_jobs() -> list[dict]:
    """Return info about all scheduled jobs."""
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger": str(job.trigger),
        })
    return jobs
