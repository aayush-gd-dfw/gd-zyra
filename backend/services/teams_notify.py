"""
Microsoft Teams notification service.
Sends a 1:1 Teams DM to an employee when they are assigned to a rule.

Required Railway environment variables:
  MS_TENANT_ID      - Azure AD tenant ID
  MS_CLIENT_ID      - App registration client ID
  MS_CLIENT_SECRET  - App registration client secret
  MS_SENDER_USER_ID - Azure AD object ID of the "from" user (e.g. admin user ID)

Azure app registration permissions needed (Application, not Delegated):
  Chat.Create
  ChatMessage.Send
  User.Read.All
"""

import os
import logging
import httpx

logger = logging.getLogger(__name__)

TENANT_ID = os.getenv("MS_TENANT_ID", "")
CLIENT_ID = os.getenv("MS_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("MS_CLIENT_SECRET", "")
SENDER_USER_ID = os.getenv("MS_SENDER_USER_ID", "")
GRAPH_BASE = "https://graph.microsoft.com/v1.0"
DASHBOARD_URL = "https://gd-zyra-production-8f0a.up.railway.app"


def _configured() -> bool:
    return all([TENANT_ID, CLIENT_ID, CLIENT_SECRET, SENDER_USER_ID])


async def _get_app_token() -> str | None:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": CLIENT_ID,
                    "client_secret": CLIENT_SECRET,
                    "scope": "https://graph.microsoft.com/.default",
                },
            )
            r.raise_for_status()
            return r.json()["access_token"]
    except Exception as e:
        logger.error(f"[teams_notify] Failed to get token: {e}")
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
            logger.warning(f"[teams_notify] User lookup failed for {email}: {r.status_code}")
            return None
    except Exception as e:
        logger.error(f"[teams_notify] User lookup error: {e}")
        return None


async def _get_or_create_chat(token: str, recipient_user_id: str) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{GRAPH_BASE}/chats",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json={
                    "chatType": "oneOnOne",
                    "members": [
                        {
                            "@odata.type": "#microsoft.graph.aadUserConversationMember",
                            "roles": ["owner"],
                            "user@odata.bind": f"{GRAPH_BASE}/users/{SENDER_USER_ID}",
                        },
                        {
                            "@odata.type": "#microsoft.graph.aadUserConversationMember",
                            "roles": ["owner"],
                            "user@odata.bind": f"{GRAPH_BASE}/users/{recipient_user_id}",
                        },
                    ],
                },
            )
            if r.status_code in (200, 201):
                return r.json().get("id")
            logger.warning(f"[teams_notify] Chat create failed: {r.status_code} {r.text[:200]}")
            return None
    except Exception as e:
        logger.error(f"[teams_notify] Chat create error: {e}")
        return None


async def _send_message(token: str, chat_id: str, text: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{GRAPH_BASE}/chats/{chat_id}/messages",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json={"body": {"content": text, "contentType": "text"}},
            )
            if r.status_code in (200, 201):
                return True
            logger.warning(f"[teams_notify] Send failed: {r.status_code} {r.text[:200]}")
            return False
    except Exception as e:
        logger.error(f"[teams_notify] Send error: {e}")
        return False


async def notify_rule_assignment(
    employee_email: str,
    employee_name: str,
    customer_type: str | None,
    customer_status: str | None,
) -> None:
    if not _configured():
        logger.info("[teams_notify] Credentials not set - skipping notification")
        return

    type_label = customer_type or "All types"
    status_label = customer_status or "All statuses"
    message = (
        f"Hey {employee_name}! You've been assigned to handle "
        f"{type_label} / {status_label} customers in the Zyra Dashboard. "
        f"Check your dashboard here: {DASHBOARD_URL}"
    )

    token = await _get_app_token()
    if not token:
        return

    user_id = await _get_user_id(token, employee_email)
    if not user_id:
        return

    chat_id = await _get_or_create_chat(token, user_id)
    if not chat_id:
        return

    ok = await _send_message(token, chat_id, message)
    if ok:
        logger.info(f"[teams_notify] Notified {employee_name} ({employee_email})")
