"""
CortexOS — Projects & Tasks API
"""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.models import User, Project, Task, TaskStatus, TaskPriority
from app.services.gemini import chat_with_gemini

router = APIRouter(prefix="/projects", tags=["projects"])

# ─── Schemas ──────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    color: str = "#2563eb"
    emoji: str = "📁"

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    emoji: Optional[str] = None
    is_archived: Optional[bool] = None

class TaskCreate(BaseModel):
    title: str
    description: str = ""
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: Optional[datetime] = None
    tags: list[str] = []
    assigned_to: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_date: Optional[datetime] = None
    tags: Optional[list[str]] = None
    assigned_to: Optional[str] = None
    position: Optional[int] = None

class AITaskRequest(BaseModel):
    prompt: str  # "Crée les tâches pour lancer mon site web"


# ─── Projects ─────────────────────────────────────────────────────────────────

@router.post("", status_code=201)
async def create_project(body: ProjectCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    p = Project(tenant_id=current_user.tenant_id, created_by=current_user.id, **body.model_dump())
    db.add(p); await db.flush()
    return _project_dict(p)

@router.get("")
async def list_projects(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Project).where(Project.tenant_id==current_user.tenant_id, Project.is_archived==False).order_by(Project.created_at.desc()))
    projects = r.scalars().all()
    result = []
    for p in projects:
        tasks_r = await db.execute(select(Task).where(Task.project_id==p.id).order_by(Task.position, Task.created_at))
        tasks = tasks_r.scalars().all()
        d = _project_dict(p)
        d["tasks"] = [_task_dict(t) for t in tasks]
        d["task_count"] = len(tasks)
        d["done_count"] = sum(1 for t in tasks if t.status == TaskStatus.DONE)
        result.append(d)
    return result

@router.get("/{project_id}")
async def get_project(project_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    p = await _get_project(project_id, current_user, db)
    tasks_r = await db.execute(select(Task).where(Task.project_id==p.id).order_by(Task.position, Task.created_at))
    tasks = tasks_r.scalars().all()
    d = _project_dict(p)
    d["tasks"] = [_task_dict(t) for t in tasks]
    return d

@router.put("/{project_id}")
async def update_project(project_id: uuid.UUID, body: ProjectUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    p = await _get_project(project_id, current_user, db)
    for k, v in body.model_dump(exclude_none=True).items(): setattr(p, k, v)
    p.updated_at = datetime.utcnow()
    return _project_dict(p)

@router.delete("/{project_id}")
async def delete_project(project_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    p = await _get_project(project_id, current_user, db)
    await db.delete(p); return {"ok": True}


# ─── Tasks ────────────────────────────────────────────────────────────────────

@router.post("/{project_id}/tasks", status_code=201)
async def create_task(project_id: uuid.UUID, body: TaskCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _get_project(project_id, current_user, db)
    t = Task(project_id=project_id, tenant_id=current_user.tenant_id, **body.model_dump())
    db.add(t); await db.flush()
    return _task_dict(t)

@router.put("/{project_id}/tasks/{task_id}")
async def update_task(project_id: uuid.UUID, task_id: uuid.UUID, body: TaskUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    t = await _get_task(task_id, current_user, db)
    for k, v in body.model_dump(exclude_none=True).items(): setattr(t, k, v)
    t.updated_at = datetime.utcnow()
    return _task_dict(t)

@router.delete("/{project_id}/tasks/{task_id}")
async def delete_task(project_id: uuid.UUID, task_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    t = await _get_task(task_id, current_user, db)
    await db.delete(t); return {"ok": True}


# ─── AI Task Generation ───────────────────────────────────────────────────────

@router.post("/{project_id}/ai-tasks")
async def generate_tasks_with_ai(project_id: uuid.UUID, body: AITaskRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Ask Gemini to generate tasks for a project."""
    p = await _get_project(project_id, current_user, db)

    prompt = f"""Tu es un expert en gestion de projet. Génère une liste de tâches structurées pour ce projet.

Projet : {p.name}
Description : {p.description or "Non précisée"}
Demande : {body.prompt}

Réponds UNIQUEMENT avec une liste JSON valide de tâches, sans texte avant ou après :
[
  {{"title": "Titre de la tâche", "description": "Description courte", "priority": "high|medium|low|urgent", "status": "todo"}},
  ...
]

Génère entre 3 et 8 tâches pertinentes et actionnables."""

    response = await chat_with_gemini([{"role": "user", "content": prompt}])

    # Extract JSON
    import json, re
    json_match = re.search(r'\[.*\]', response, re.DOTALL)
    if not json_match:
        raise HTTPException(status_code=500, detail="L'IA n'a pas retourné un format valide")

    try:
        tasks_data = json.loads(json_match.group())
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Erreur de parsing JSON")

    created = []
    for i, td in enumerate(tasks_data[:10]):
        priority = td.get("priority", "medium")
        if priority not in ["low", "medium", "high", "urgent"]: priority = "medium"
        t = Task(
            project_id=project_id,
            tenant_id=current_user.tenant_id,
            title=td.get("title", "Nouvelle tâche"),
            description=td.get("description", ""),
            priority=TaskPriority(priority),
            status=TaskStatus.TODO,
            position=i,
        )
        db.add(t)
        created.append(t)
    await db.flush()
    return {"tasks": [_task_dict(t) for t in created], "count": len(created)}


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _get_project(pid: uuid.UUID, user: User, db: AsyncSession) -> Project:
    r = await db.execute(select(Project).where(Project.id==pid, Project.tenant_id==user.tenant_id))
    p = r.scalar_one_or_none()
    if not p: raise HTTPException(404, "Projet introuvable")
    return p

async def _get_task(tid: uuid.UUID, user: User, db: AsyncSession) -> Task:
    r = await db.execute(select(Task).where(Task.id==tid, Task.tenant_id==user.tenant_id))
    t = r.scalar_one_or_none()
    if not t: raise HTTPException(404, "Tâche introuvable")
    return t

def _project_dict(p: Project) -> dict:
    return {"id": str(p.id), "name": p.name, "description": p.description, "color": p.color, "emoji": p.emoji, "is_archived": p.is_archived, "created_at": p.created_at.isoformat(), "updated_at": p.updated_at.isoformat()}

def _task_dict(t: Task) -> dict:
    return {"id": str(t.id), "project_id": str(t.project_id), "title": t.title, "description": t.description, "status": t.status, "priority": t.priority, "due_date": t.due_date.isoformat() if t.due_date else None, "tags": t.tags, "position": t.position, "created_at": t.created_at.isoformat(), "updated_at": t.updated_at.isoformat()}
