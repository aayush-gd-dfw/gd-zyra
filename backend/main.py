import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, AsyncSessionLocal
from models import Base
from routes.auth_routes import router as auth_router
from routes.call_routes import router as call_router
from routes.rules_routes import router as rules_router
from routes.employee_routes import router as employee_router
from services.graph_poller import poll_loop
from services.call_processor import handle_zyra_email
from config import get_settings
from sqlalchemy import text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


async def process_email(subject: str, body: str, received_at: str = "", message_id: str = ""):
    async with AsyncSessionLocal() as db:
        call_id = await handle_zyra_email(
            subject=subject, body=body, received_at=received_at, db=db, message_id=message_id,
        )
        logger.info(f"Zyra email → call record {call_id}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Add new columns to existing tables if missing
        await conn.execute(text(
            "ALTER TABLE zyra_calls ADD COLUMN IF NOT EXISTS assigned_to_id UUID"
        ))
        await conn.execute(text(
            "ALTER TABLE zyra_calls ADD COLUMN IF NOT EXISTS assigned_to_name VARCHAR"
        ))
        await conn.execute(text(
            "ALTER TABLE zyra_calls ADD COLUMN IF NOT EXISTS graph_message_id VARCHAR"
        ))
        await conn.execute(text(
            "ALTER TABLE zyra_calls ADD COLUMN IF NOT EXISTS task_status VARCHAR NOT NULL DEFAULT 'To Do'"
        ))
        # Partial unique index — safe even if column existed without constraint.
        # If this fails (duplicates present), run cleanup_duplicates.py then restart.
        try:
            await conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_zyra_calls_msg_id "
                "ON zyra_calls(graph_message_id) WHERE graph_message_id IS NOT NULL"
            ))
        except Exception as idx_err:
            logger.warning(
                f"Unique index on graph_message_id skipped (run cleanup_duplicates.py first): {idx_err}"
            )
        await conn.execute(text(
            """CREATE TABLE IF NOT EXISTS assignment_rules (
                id SERIAL PRIMARY KEY,
                customer_type VARCHAR,
                customer_status VARCHAR,
                employee_id UUID,
                employee_name VARCHAR,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )"""
        ))
    logger.info("DB tables ready")

    poller_task = None
    if settings.azure_client_secret:
        poller_task = asyncio.create_task(poll_loop(process_email))
        logger.info("Zyra poller started")
    else:
        logger.info("AZURE_CLIENT_SECRET not set — polling disabled")
    yield
    if poller_task:
        poller_task.cancel()


app = FastAPI(title="Glass Doctor DFW — Zyra Dashboard", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(call_router)
app.include_router(rules_router)
app.include_router(employee_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "gd-zyra"}
