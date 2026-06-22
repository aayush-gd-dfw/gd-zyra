"""
Microsoft Teams 1:1 DM notification service.
Uses the same Azure credentials as the graph poller (azure_tenant_id etc. in Settings).
Requires one additional Railway env var:
  MS_SENDER_USER_ID - Azure AD object ID of the "from" user for outbound DMs

Azure app registration permissions needed (Application):
  Chat.Create, ChatMessage.Send, User.Read.All
"""
import logging
import httpx
from config import get_settings

logger = logging.getLogger(__name__)
GRAPH_BASE = "https://graph.microsoft.com/v1.0"
DASHBOARD_URL = "https://gd-zyra-production-8f0a.up.railway.app"


def _configured() -> bool:
    s = get_settings()
    return all([s.azure_tenant_id, s.azure_client_id, s.azure_client_secret, s.ms_sender_user_id])


async def _get_token() -> str | None:
    s = get_settings()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"https://login.microsoftonline.com/{s.azure_tenant_id}/oauth2/v2.0/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": s.azure_client_id,
                    "client_secret": s.azure_client_secret,
                    "scope": "https://graph.microsoft.com/.default",
                },
            )
            r.raise_for_status()
            return r.json()["access_token"]
    except Exception as e:
        logger.error(f"[teams_notify] Token error: {e}")
        return None


async def _get_user_id(token: str, email: str) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{GRAPH_BASE}/users/{email}",
                headers={"Authorization": f"Bearer {token}"},
            )
            if r.status_code == 200:
                return r.json().get("id")
            logger.warning(f"[teams_notify] User not found for {email}: {r.status_code}")
            return None
    except Exception as e:
        logger.error(f"[teams_notify] User lookup error: {e}")
        return None


async def _get_or_create_chat(token: str, recipient_id: str) -> str | None:
    s = get_settings()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{GRAPH_BASE}/chats",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "chatType": "oneOnOne",
                    "members": [
                        {
                            "@odata.type": "#microsoft.graph.aadUserConversationMember",
                            "roles": ["owner"],
                            "user@odata.bind": f"{GRAPH_BASE}/users/{s.ms_sender_user_id}",
                        },
                        {
                            "@odata.type": "#microsoft.graph.aadUserConversationMember",
                            "roles": ["owner"],
                            "user@odata.bind": f"{GRAPH_BASE}/users/{recipient_id}",
                        },
                    ],
                },
            )
            if r.status_code in (200, 201):
                return r.json().get("id")
            logger.warning(f"[teams_notify] Chat create failed: {r.status_code} {r.text[:300]}")
            return None
    except Exception as e:
        logger.error(f"[teams_notify] Chat create error: {e}")
        return None


async def notify_dm(employee_email: str, employee_name: str, message: str) -> None:
    """Send a 1:1 Teams DM. Errors are logged but never raised."""
    if not _configured():
        logger.info("[teams_notify] Skipping DM — MS_SENDER_USER_ID or Azure creds not set")
        return
    try:
        token = await _get_token()
        if not token:
            return
        user_id = await _get_user_id(token, employee_email)
        if not user_id:
            return
        chat_id = await _get_or_create_chat(token, user_id)
        if not chat_id:
            return
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{GRAPH_BASE}/chats/{chat_id}/messages",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={"body": {"content": message, "contentType": "text"}},
            )
            if r.status_code in (200, 201):
                logger.info(f"[teams_notify] DM sent to {employee_name} ({employee_email})")
            else:
                logger.warning(f"[teams_notify] Send failed: {r.status_code} {r.text[:200]}")
    except Exception as e:
        logger.error(f"[teams_notify] notify_dm error: {e}")


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
    await notify_dm(employee_email, employee_name, msg)


async def notify_call_assignment(
    employee_email: str,
    employee_name: str,
    customer_phone: str | None,
    customer_type: str | None,
    customer_status: str | None,
) -> None:
    parts = []
    if customer_phone:
        parts.append(f"Phone: {customer_phone}")
    if customer_type or customer_status:
        parts.append(f"Type: {customer_type or '—'} / {customer_status or '—'}")
    detail = " | ".join(parts)
    msg = (
        f"Hey {employee_name}! A call has been assigned to you on the Zyra Dashboard."
        + (f" {detail}." if detail else "")
        + f" Check it here: {DASHBOARD_URL}"
    )
    await notify_dm(employee_email, employee_name, msg)
