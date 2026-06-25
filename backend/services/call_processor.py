"""
Processes a Zyra email: extracts call info, deduplicates by graph_message_id,
auto-assigns via rules, stores ZyraCall, and fires a Teams notification.

Extraction order:
1. Gemini Flash (if GEMINI_API_KEY is set) -- richer AI extraction
2. Text extractor (always available) -- regex-based fallback
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import ZyraCall, Employee
from services.text_extractor import extract_call_info_from_text
from services.assignment_engine import get_auto_assignment
from services.teams_notifier import notify_assignment
from services.teams_notify import notify_call_assignment

logger = logging.getLogger(__name__)


def _parse_received_at(received_at: str) -> datetime:
    if not received_at:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(received_at.replace("Z", "+00:00"))
    except Exception:
        return datetime.now(timezone.utc)


async def _try_gemini(body: str):
    try:
        from config import get_settings
        settings = get_settings()
        if not settings.gemini_api_key:
            return None
        from services.gemini_extractor import extract_call_info
        result = await extract_call_info(body)
        if result and result.get("customer_type"):
            return result
    except Exception as e:
        logger.warning(f"Gemini extraction failed: {e}")
    return None


async def handle_zyra_email(
    subject: str,
    body: str,
    received_at: str,
    db: AsyncSession,
    message_id: str = "",
) -> str:
    """Extract call info, deduplicate, auto-assign, store ZyraCall, notify. Returns record ID."""

    # Deduplicate by Graph message ID
    if message_id:
        existing = await db.execute(
            select(ZyraCall).where(ZyraCall.graph_message_id == message_id)
        )
        if existing.scalar_one_or_none():
            logger.info(f"Skipping duplicate (message_id): {message_id[:30]}")
            return None

    # Fallback dedup: same subject received within 2 minutes (catches null message_id re-fetches)
    if subject:
        recv_dt = _parse_received_at(received_at)
        existing2 = await db.execute(
            select(ZyraCall).where(
                ZyraCall.email_subject == subject,
                ZyraCall.received_at >= recv_dt - timedelta(minutes=2),
                ZyraCall.received_at <= recv_dt + timedelta(minutes=2),
            )
        )
        if existing2.scalar_one_or_none():
            logger.info(f"Skipping duplicate (subject+time): {subject[:50]}")
            return None

    # 1. Try Gemini if key available
    extracted = await _try_gemini(body)

    # 2. Fall back to text extractor
    if not extracted:
        extracted = extract_call_info_from_text(body)

    # 3. Auto-assign via rules
    emp_id, emp_name = await get_auto_assignment(
        extracted.get("customer_type"), extracted.get("customer_status"), db
    )

    call = ZyraCall(
        graph_message_id=message_id or None,
        email_subject=subject,
        received_at=_parse_received_at(received_at),
        raw_body=body,
        customer_type=extracted.get("customer_type") or None,
        customer_status=extracted.get("customer_status") or None,
        summary=extracted.get("summary") or None,
        customer_phone=extracted.get("customer_phone") or None,
        ai_processed=bool(extracted.get("customer_type")),
        assigned_to_id=emp_id,
        assigned_to_name=emp_name,
    )

    db.add(call)
    await db.commit()
    await db.refresh(call)

    # 4. Fire Teams notifications if auto-assigned
    if emp_name:
        # Channel webhook notification
        await notify_assignment(
            emp_name,
            call.customer_phone,
            call.customer_type,
            call.customer_status,
            call.summary,
        )
        # 1:1 DM notification via Power Automate
        if emp_id:
            emp_result = await db.execute(select(Employee).where(Employee.id == emp_id))
            emp = emp_result.scalar_one_or_none()
            if emp and emp.email:
                asyncio.create_task(
                    notify_call_assignment(
                        employee_email=emp.email,
                        employee_name=emp_name,
                        customer_phone=call.customer_phone,
                        customer_type=call.customer_type,
                        customer_status=call.customer_status,
                    )
                )

    logger.info(
        f"Zyra call saved -- type={call.customer_type} status={call.customer_status} "
        f"phone={call.customer_phone} assigned={emp_name} ai_processed={call.ai_processed}"
    )
    return call.id
