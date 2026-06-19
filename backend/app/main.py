"""
CortexOS — FastAPI Application
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.api.v1 import auth, chat, dashboard, sources, google


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — graceful if DB not available (e.g. Docker not running)
    try:
        await init_db()
        print("✅ Database connected and tables created.")
    except Exception as e:
        print(f"⚠️  Database unavailable (Docker not running?): {e}")
        print("   Starting without DB — auth endpoints will fail until DB is up.")
    yield
    # Shutdown (cleanup if needed)


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

# Future routers (uncomment as you build them):
# app.include_router(sources.router, prefix="/api/v1")
# app.include_router(sources.router, prefix="/api/v1")
# app.include_router(ingestion.router, prefix="/api/v1")


# ─── Health check ─────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
