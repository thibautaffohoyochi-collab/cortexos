"""
CortexOS — Export API
GET /exports/chat/{session_id}/pdf     → HTML printable (browser prints to PDF)
GET /exports/chat/{session_id}/csv     → CSV of messages
GET /exports/competitive/pdf           → competitive analysis HTML report
GET /exports/competitive/csv           → competitors CSV
GET /exports/projects/{id}/csv         → tasks CSV
"""
import csv
import io
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.models import User, ChatSession, Message, Competitor, Project, Task
import uuid

router = APIRouter(prefix="/exports", tags=["exports"])


# ─── HTML template ────────────────────────────────────────────────────────────

def html_doc(title: str, body: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>{title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ font-family:'Inter',sans-serif; color:#1d1d1f; background:#fff; padding:48px; max-width:900px; margin:0 auto; }}
  h1 {{ font-size:28px; font-weight:700; margin-bottom:8px; color:#1d1d1f; }}
  h2 {{ font-size:18px; font-weight:600; margin:24px 0 8px; color:#1d1d1f; }}
  .meta {{ font-size:13px; color:#6e6e73; margin-bottom:32px; }}
  .logo {{ font-size:20px; font-weight:700; margin-bottom:24px; color:#1d1d1f; }}
  .divider {{ border:none; border-top:1px solid #e5e7eb; margin:24px 0; }}
  .msg {{ margin:12px 0; }}
  .msg-user {{ background:#1d1d1f; color:#fff; padding:12px 16px; border-radius:12px 12px 3px 12px; display:inline-block; max-width:80%; float:right; clear:both; }}
  .msg-ai {{ background:#f5f5f7; color:#1d1d1f; padding:12px 16px; border-radius:12px 12px 12px 3px; display:inline-block; max-width:80%; float:left; clear:both; }}
  .msg-label {{ font-size:11px; font-weight:600; color:#6e6e73; margin-bottom:4px; }}
  .clearfix {{ clear:both; }}
  .section {{ background:#f9f9f9; border:1px solid #e5e7eb; border-radius:12px; padding:20px; margin:16px 0; }}
  .score {{ display:inline-block; background:#0066cc; color:#fff; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; }}
  .tag {{ display:inline-block; background:#e5e7eb; color:#1d1d1f; padding:2px 8px; border-radius:4px; font-size:11px; margin:2px; }}
  pre {{ white-space:pre-wrap; font-family:inherit; font-size:13px; line-height:1.6; }}
  @media print {{
    body {{ padding:24px; }}
    .no-print {{ display:none; }}
  }}
  .print-btn {{ position:fixed; top:20px; right:20px; background:#1d1d1f; color:#fff; border:none; padding:10px 20px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; z-index:999; }}
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨 Imprimer / Enregistrer en PDF</button>
<div class="logo">⬡ CortexOS</div>
{body}
<hr class="divider"/>
<p class="meta">Exporté depuis CortexOS · {datetime.now().strftime("%d/%m/%Y à %H:%M")}</p>
</body>
</html>"""


# ─── Chat Export ──────────────────────────────────────────────────────────────

@router.get("/chat/{session_id}/pdf", response_class=HTMLResponse)
async def export_chat_pdf(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Get session
    r = await db.execute(select(ChatSession).where(
        ChatSession.id == session_id,
        ChatSession.tenant_id == current_user.tenant_id,
    ))
    session = r.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session introuvable")

    # Get messages
    r = await db.execute(select(Message).where(Message.session_id == session_id).order_by(Message.created_at))
    messages = r.scalars().all()

    msgs_html = ""
    for m in messages:
        content = m.content.replace("\n", "<br/>")
        if m.role == "user":
            msgs_html += f'<div class="msg"><div class="msg-user"><div class="msg-label">Vous</div>{content}</div></div><div class="clearfix"></div>'
        else:
            msgs_html += f'<div class="msg"><div class="msg-ai"><div class="msg-label">⬡ CortexOS</div>{content}</div></div><div class="clearfix"></div>'

    body = f"""
<h1>{session.title}</h1>
<p class="meta">Conversation · {session.created_at.strftime("%d/%m/%Y")} · {len(messages)} messages</p>
<hr class="divider"/>
{msgs_html}
"""
    return HTMLResponse(html_doc(session.title, body))


@router.get("/chat/{session_id}/csv")
async def export_chat_csv(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(ChatSession).where(
        ChatSession.id == session_id,
        ChatSession.tenant_id == current_user.tenant_id,
    ))
    session = r.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session introuvable")

    r = await db.execute(select(Message).where(Message.session_id == session_id).order_by(Message.created_at))
    messages = r.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Rôle", "Message"])
    for m in messages:
        writer.writerow([m.created_at.strftime("%d/%m/%Y %H:%M"), m.role, m.content])

    output.seek(0)
    filename = f"chat_{session.title[:30].replace(' ','_')}.csv"
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'})


# ─── Competitive Export ───────────────────────────────────────────────────────

@router.get("/competitive/pdf", response_class=HTMLResponse)
async def export_competitive_pdf(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Competitor).where(Competitor.tenant_id == current_user.tenant_id))
    competitors = r.scalars().all()

    if not competitors:
        raise HTTPException(400, "Aucun concurrent à exporter")

    items_html = ""
    for c in competitors:
        analysis = c.last_analysis or "Non analysé"
        analysis_html = analysis.replace("\n", "<br/>")
        items_html += f"""
<div class="section">
  <h2>{c.name}</h2>
  {"<p><a href='" + c.website + "'>" + c.website + "</a></p>" if c.website else ""}
  <p class="meta">Dernière analyse : {c.last_scraped_at.strftime("%d/%m/%Y") if c.last_scraped_at else "Jamais"}</p>
  <pre>{analysis_html}</pre>
</div>
"""

    body = f"""
<h1>Rapport de Veille Concurrentielle</h1>
<p class="meta">{len(competitors)} concurrent(s) analysé(s)</p>
<hr class="divider"/>
{items_html}
"""
    return HTMLResponse(html_doc("Veille Concurrentielle", body))


@router.get("/competitive/csv")
async def export_competitive_csv(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Competitor).where(Competitor.tenant_id == current_user.tenant_id))
    competitors = r.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Nom", "Site web", "Description", "Dernière analyse", "Résumé analyse"])
    for c in competitors:
        writer.writerow([
            c.name, c.website or "", c.description or "",
            c.last_scraped_at.strftime("%d/%m/%Y") if c.last_scraped_at else "",
            (c.last_analysis or "")[:500],
        ])

    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="concurrents.csv"'})


# ─── Projects Export ──────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/csv")
async def export_project_csv(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Project).where(
        Project.id == project_id,
        Project.tenant_id == current_user.tenant_id,
    ))
    project = r.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Projet introuvable")

    r = await db.execute(select(Task).where(Task.project_id == project_id).order_by(Task.status, Task.priority))
    tasks = r.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Titre", "Statut", "Priorité", "Description", "Date limite", "Créé le"])
    for t in tasks:
        writer.writerow([
            t.title,
            {"todo":"À faire","in_progress":"En cours","done":"Terminé"}.get(t.status, t.status),
            {"urgent":"🔴 Urgent","high":"🟠 Haute","medium":"🟡 Moyenne","low":"🟢 Basse"}.get(t.priority, t.priority),
            t.description or "",
            t.due_date.strftime("%d/%m/%Y") if t.due_date else "",
            t.created_at.strftime("%d/%m/%Y"),
        ])

    output.seek(0)
    filename = f"projet_{project.name[:30].replace(' ','_')}.csv"
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/projects/{project_id}/pdf", response_class=HTMLResponse)
async def export_project_pdf(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Project).where(
        Project.id == project_id,
        Project.tenant_id == current_user.tenant_id,
    ))
    project = r.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Projet introuvable")

    r = await db.execute(select(Task).where(Task.project_id == project_id).order_by(Task.status))
    tasks = r.scalars().all()

    STATUS_MAP = {"todo": "⭕ À faire", "in_progress": "🔵 En cours", "done": "✅ Terminé"}
    PRIORITY_MAP = {"urgent": "🔴 Urgent", "high": "🟠 Haute", "medium": "🟡 Moyenne", "low": "🟢 Basse"}

    done = sum(1 for t in tasks if t.status == "done")
    progress = round(done / len(tasks) * 100) if tasks else 0

    tasks_html = ""
    for col_key, col_label in [("todo","À faire"),("in_progress","En cours"),("done","Terminé")]:
        col_tasks = [t for t in tasks if t.status == col_key]
        if not col_tasks:
            continue
        tasks_html += f"<h2>{STATUS_MAP[col_key]} ({len(col_tasks)})</h2>"
        for t in col_tasks:
            tasks_html += f"""
<div class="section">
  <strong>{t.title}</strong>
  <span class="tag">{PRIORITY_MAP.get(t.priority,'')}</span>
  {f"<p style='margin-top:6px;font-size:13px;color:#6e6e73'>{t.description}</p>" if t.description else ""}
  {f"<p style='font-size:12px;color:#6e6e73;margin-top:4px'>📅 {t.due_date.strftime('%d/%m/%Y')}</p>" if t.due_date else ""}
</div>
"""

    body = f"""
<h1>{project.emoji} {project.name}</h1>
<p class="meta">{project.description or ""}</p>
<p class="meta">{len(tasks)} tâches · {done} terminées · <strong>{progress}% complété</strong></p>
<hr class="divider"/>
{tasks_html}
"""
    return HTMLResponse(html_doc(project.name, body))
