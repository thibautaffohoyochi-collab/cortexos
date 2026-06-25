"""
CortexOS — FastAPI Application
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.api.v1 import auth, chat, dashboard, sources, google, team, settings, workflows, competitive, projects, exports, assistant, websearch, admin, billing
from app.services.scheduler import scheduler, load_all_scheduled_workflows


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        await init_db()
        print("✅ Database connected and tables created.")
    except Exception as e:
        print(f"⚠️  Database unavailable (Docker not running?): {e}")
        print("   Starting without DB — auth endpoints will fail until DB is up.")

    # Start scheduler
    try:
        scheduler.start()
        await load_all_scheduled_workflows()
        print("✅ Scheduler started.")
    except Exception as e:
        print(f"⚠️  Scheduler failed to start: {e}")

    yield

    # Shutdown
    try:
        scheduler.shutdown(wait=False)
        print("✅ Scheduler stopped.")
    except Exception:
        pass


app = FastAPI(
    title="CortexOS API",
    version="0.1.0",
    description="AI Operating System for businesses",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://cortexos-xi.vercel.app",
        "https://*.vercel.app",
        "https://cortexos-production-71fa.up.railway.app",
        "https://*.onrender.com",
        "https://cortexos.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(sources.router, prefix="/api/v1")
app.include_router(google.router, prefix="/api/v1")
app.include_router(team.router, prefix="/api/v1")
app.include_router(settings.router, prefix="/api/v1")
app.include_router(workflows.router, prefix="/api/v1")
app.include_router(competitive.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(exports.router, prefix="/api/v1")
app.include_router(assistant.router, prefix="/api/v1")
app.include_router(websearch.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(billing.router, prefix="/api/v1")

# ─── Scheduler status ──────────────────────────────────────────────────────────
from fastapi import Depends as _Depends
from app.core.auth import get_current_user as _get_current_user
from app.models.models import User as _User
from app.services.scheduler import list_scheduled_jobs

@app.get("/api/v1/scheduler/jobs")
async def get_scheduled_jobs(current_user: _User = _Depends(_get_current_user)):
    """List all active scheduled workflow jobs."""
    return {"jobs": list_scheduled_jobs(), "total": len(list_scheduled_jobs())}

# Future routers (uncomment as you build them):
# app.include_router(sources.router, prefix="/api/v1")
# app.include_router(sources.router, prefix="/api/v1")
# app.include_router(ingestion.router, prefix="/api/v1")


# ─── Health check ─────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
