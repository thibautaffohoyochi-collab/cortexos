"""
CortexOS — Workflow Engine
Executes multi-step agent workflows.

Step types:
  - search_sources: search Qdrant for relevant data
  - ask_ai: send a prompt to Gemini
  - summarize: summarize previous step output
  - send_email: send result via Resend
  - save_to_chat: save result as a chat session
"""
from datetime import datetime
from typing import Any
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.gemini import chat_with_gemini
from app.services.qdrant_service import search as qdrant_search
from app.services.email_service import send_invite_email
from app.models.models import WorkflowRun, WorkflowStatus, ChatSession, Message


async def execute_step(
    step: dict,
    context: dict,  # shared context between steps
    tenant_id: str,
    db: AsyncSession,
) -> dict:
    """
    Execute a single workflow step.
    Returns {"output": str, "success": bool, "error": str|None}
    """
    step_type = step.get("type")
    config = step.get("config", {})

    try:
        if step_type == "search_sources":
            query = _resolve_template(config.get("query", ""), context)
            results = await qdrant_search(query, tenant_id=tenant_id, limit=config.get("limit", 5))
            output = "\n\n".join([
                f"[{r['title']}] {r['text']}" for r in results
            ]) or "Aucun résultat trouvé."
            return {"output": output, "success": True, "error": None}

        elif step_type == "ask_ai":
            prompt = _resolve_template(config.get("prompt", ""), context)
            # Include previous context if requested
            if config.get("use_context", True) and context.get("last_output"):
                prompt = f"{prompt}\n\nContexte disponible :\n{context['last_output']}"
            messages = [{"role": "user", "content": prompt}]
            output = await chat_with_gemini(messages)
            return {"output": output, "success": True, "error": None}

        elif step_type == "summarize":
            content = _resolve_template(config.get("content", "{{last_output}}"), context)
            prompt = f"Résume ce contenu de manière concise et structurée :\n\n{content}"
            messages = [{"role": "user", "content": prompt}]
            output = await chat_with_gemini(messages)
            return {"output": output, "success": True, "error": None}

        elif step_type == "send_email":
            to_email = config.get("to_email", "")
            subject = _resolve_template(config.get("subject", "Rapport CortexOS"), context)
            body = _resolve_template(config.get("body", "{{last_output}}"), context)

            # Use email service
            from app.core.config import settings
            import httpx
            if settings.RESEND_API_KEY:
                html = f"<div style='font-family:sans-serif;max-width:600px;margin:0 auto'><h2>{subject}</h2><div style='white-space:pre-wrap'>{body}</div><hr><p style='color:#666;font-size:12px'>Envoyé par CortexOS</p></div>"
                async with httpx.AsyncClient(timeout=15.0) as client:
                    await client.post(
                        "https://api.resend.com/emails",
                        headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}", "Content-Type": "application/json"},
                        json={"from": "CortexOS <onboarding@resend.dev>", "to": [to_email], "subject": subject, "html": html}
                    )
            return {"output": f"Email envoyé à {to_email}", "success": True, "error": None}

        elif step_type == "save_to_chat":
            title = _resolve_template(config.get("title", "Résultat workflow"), context)
            content = _resolve_template(config.get("content", "{{last_output}}"), context)

            session = ChatSession(
                tenant_id=uuid.UUID(tenant_id),
                user_id=uuid.UUID(context.get("user_id", str(uuid.uuid4()))),
                title=title[:50],
            )
            db.add(session)
            await db.flush()

            msg = Message(
                session_id=session.id,
                role="assistant",
                content=f"**Résultat du workflow : {title}**\n\n{content}",
            )
            db.add(msg)
            return {"output": f"Sauvegardé dans le chat : {title}", "success": True, "error": None}

        else:
            return {"output": "", "success": False, "error": f"Type d'étape inconnu : {step_type}"}

    except Exception as e:
        return {"output": "", "success": False, "error": str(e)}


def _resolve_template(template: str, context: dict) -> str:
    """Replace {{variable}} placeholders with context values."""
    result = template
    for key, value in context.items():
        result = result.replace(f"{{{{{key}}}}}", str(value) if value else "")
    return result


async def run_workflow(
    workflow_run: WorkflowRun,
    workflow_steps: list,
    tenant_id: str,
    user_id: str,
    db: AsyncSession,
) -> None:
    """Execute all steps of a workflow and update the run record."""
    workflow_run.status = WorkflowStatus.RUNNING
    workflow_run.started_at = datetime.utcnow()

    context = {
        "tenant_id": tenant_id,
        "user_id": user_id,
        "last_output": "",
    }
    steps_results = []

    for i, step in enumerate(workflow_steps):
        step_name = step.get("name", f"Étape {i+1}")
        result = await execute_step(step, context, tenant_id, db)

        steps_results.append({
            "step": i + 1,
            "name": step_name,
            "type": step.get("type"),
            "output": result["output"],
            "success": result["success"],
            "error": result["error"],
        })

        if result["success"]:
            context["last_output"] = result["output"]
            context[f"step_{i+1}_output"] = result["output"]
        else:
            # Stop on failure
            workflow_run.status = WorkflowStatus.FAILED
            workflow_run.error = f"Échec à l'étape {i+1} ({step_name}): {result['error']}"
            workflow_run.steps_results = steps_results
            workflow_run.completed_at = datetime.utcnow()
            return

    workflow_run.status = WorkflowStatus.COMPLETED
    workflow_run.final_output = context.get("last_output", "")
    workflow_run.steps_results = steps_results
    workflow_run.completed_at = datetime.utcnow()
