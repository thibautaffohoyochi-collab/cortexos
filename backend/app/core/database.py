from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text
from app.core.config import settings
from app.models.models import Base

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.APP_ENV == "development",
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def _run_migrations(conn):
    """
    Apply incremental schema changes that create_all won't handle
    (adding columns to existing tables).
    Uses IF NOT EXISTS so it's safe to run on every startup.
    """
    migrations = [
        # v2 — user memory
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS memory JSONB DEFAULT '{}'::jsonb",
    ]
    for sql in migrations:
        try:
            await conn.execute(text(sql))
        except Exception as e:
            print(f"[Migration] Warning: {e}")


async def init_db():
    """Create all tables on startup and run incremental migrations."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _run_migrations(conn)


async def get_db() -> AsyncSession:
    """FastAPI dependency — yields a DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
