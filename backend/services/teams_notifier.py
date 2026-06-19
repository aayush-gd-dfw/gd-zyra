"""Post a Teams notification card when a call is assigned."""
import logging
import httpx
from config import get_settings

logger = logging.getLogger(__name__)


async def notify_assignment(
    employee_name: str,
    customer_phone=None,
    customer_type=None,
    customer_status=None,
    summary=None,
):
    settings = get_settings()
    if not settings.teams_webhook_url:
        return
    try:
        lines = [f"📞 **New call assigned to {employee_name}**"]
        if customer_phone:
            lines.append(f"Phone: {customer_phone}")
        if customer_type or customer_status:
            lines.append(f"Type: {customer_type or '—'} | Status: {customer_status or '—'}")
        if summary:
            lines.append(f"\n> {summary[:300]}")
        payload = {
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            "themeColor": "7c3aed",
            "summary": f"Zyra call assigned to {employee_name}",
            "sections": [{"text": "\n\n".join(lines)}],
        }
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(settings.teams_webhook_url, json=payload)
            logger.info(f"Teams notification: {resp.status_code}")
    except Exception as e:
        logger.warning(f"Teams notification failed: {e}")
