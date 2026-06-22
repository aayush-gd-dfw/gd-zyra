"""
Teams 1:1 DM notifications via Power Automate HTTP trigger (Workflows bot).
Posts as the "Workflows" Flow bot -- no protected Graph API needed.

Required Railway env var:
  TEAMS_WORKFLOW_URL  - Power Automate HTTP trigger SAS URL
"""
import logging
import httpx
from config import get_settings

DASHBOARD_URL = "https://gd-zyra-production-8f0a.up.railway.app"
logger = logging.getLogger(__name__)


async def notify_dm(employee_email: str, message: str) -> None:
    url = get_settings().teams_workflow_url
    if not url:
        logger.info("[teams_notify] TEAMS_WORKFLOW_URL not set -- skipping DM")
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(url, json={"email": employee_email, "message": message})
            r.raise_for_status()
            logger.info(f"[teams_notify] DM sent to {employee_email}")
    except Exception as e:
        logger.error(f"[teams_notify] DM failed for {employee_email}: {e}")


async def notify_rule_assignment(
    employee_email: str,
    employee_name: str,
    customer_type: str | None,
    customer_status: str | None,
) -> None:
    type_label = customer_type or "All types"
    status_label = customer_status or "All statuses"
    msg = (
        f"Hey {employee_name}! You've been assigned to handle "
        f"{type_label} / {status_label} customers in the Zyra Dashboard. "
        f"Check your dashboard: {DASHBOARD_URL}"
    )
    await notify_dm(employee_email, msg)


async def notify_call_assignment(
    employee_email: str,
    employee_name: str,
    customer_phone: str | None,
    customer_type: str | None,
    customer_status: str | None,
) -> None:
    msg = (
        f"Hey {employee_name}! A call from {customer_phone or 'unknown number'} has been "
        f"assigned to you ({customer_type or 'Unknown type'} / {customer_status or 'Unknown status'}).  "
        f"Check your dashboard: {DASHBOARD_URL}"
    )
    await notify_dm(employee_email, msg)
