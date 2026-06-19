"""
Microsoft Graph API poller - reads Outlook Zyra folder for new call summary emails.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
import httpx
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_graph_token_cache: dict = {"token": None, "expires_at": 0}
_last_poll_time: Optional[str] = None


async def _get_graph_token() -> str:
    import time
    if _graph_token_cache["token"] and time.time() < _graph_token_cache["expires_at"] - 60:
        return _graph_token_cache["token"]
    if not settings.azure_client_secret:
        return ""
    url = f"https://login.microsoftonline.com/{settings.azure_tenant_id}/oauth2/v2.0/token"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(url, data={
            "grant_type": "client_credentials",
            "client_id": settings.azure_client_id,
            "client_secret": settings.azure_client_secret,
            "scope": "https://graph.microsoft.com/.default",
        })
        resp.raise_for_status()
        data = resp.json()
        _graph_token_cache["token"] = data["access_token"]
        _graph_token_cache["expires_at"] = time.time() + data.get("expires_in", 3600)
        return _graph_token_cache["token"]


async def _get_folder_id(token: str) -> Optional[str]:
    if settings.outlook_folder_id:
        logger.info(f"Using hardcoded folder ID: {settings.outlook_folder_id[:30]}...")
        return settings.outlook_folder_id
    headers = {"Authorization": f"Bearer {token}"}
    base = f"https://graph.microsoft.com/v1.0/users/{settings.outlook_user_email}"
    target = settings.outlook_folder_name.lower()
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(f"{base}/mailFolders", headers=headers, params={"$top": "100"})
        resp.raise_for_status()
        for f in resp.json().get("value", []):
            if f.get("displayName", "").lower() == target:
                return f["id"]
        url = f"{base}/mailFolders/Inbox/childFolders"
        all_children = []
        while url:
            r = await client.get(url, headers=headers, params={"$top": "100"})
            r.raise_for_status()
            data = r.json()
            all_children.extend(data.get("value", []))
            url = data.get("@odata.nextLink")
        for f in all_children:
            if f.get("displayName", "").lower() == target:
                logger.info(f"Found folder '{settings.outlook_folder_name}' as Inbox subfolder")
                return f["id"]
    logger.warning(f"Folder '{settings.outlook_folder_name}' not found.")
    return None


async def fetch_new_emails() -> list[dict]:
    global _last_poll_time
    try:
        token = await _get_graph_token()
        if not token:
            return []
        folder_id = await _get_folder_id(token)
        if not folder_id:
            return []
        params = {
            "$select": "id,subject,body,receivedDateTime,from",
            "$orderby": "receivedDateTime asc",
            "$top": "50",
        }
        if _last_poll_time:
            params["$filter"] = f"receivedDateTime gt {_last_poll_time}"
        url = (f"https://graph.microsoft.com/v1.0/users/{settings.outlook_user_email}"
               f"/mailFolders/{folder_id}/messages")
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers={
                "Authorization": f"Bearer {token}",
                "Prefer": 'outlook.body-content-type="text"',
            }, params=params)
            resp.raise_for_status()
            messages = resp.json().get("value", [])
        results = []
        for msg in messages:
            results.append({
                "message_id": msg.get("id", ""),
                "subject": msg.get("subject", ""),
                "body": msg.get("body", {}).get("content", ""),
                "received_at": msg.get("receivedDateTime", ""),
                "sender": msg.get("from", {}).get("emailAddress", {}).get("address", ""),
            })
        if messages:
            _last_poll_time = messages[-1]["receivedDateTime"]
        return results
    except Exception as e:
        logger.error(f"Graph poll error: {e}")
        return []


async def poll_loop(process_email_fn):
    global _last_poll_time
    _last_poll_time = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    logger.info(f"Zyra poller starting from {_last_poll_time} — interval {settings.poll_interval_seconds}s")
    while True:
        try:
            emails = await fetch_new_emails()
            for email in emails:
                try:
                    await process_email_fn(
                        subject=email["subject"],
                        body=email["body"],
                        received_at=email["received_at"],
                        message_id=email.get("message_id", ""),
                    )
                    if email["received_at"]:
                        _last_poll_time = email["received_at"]
                except Exception as e:
                    logger.error(f"Error processing email '{email.get('subject', '')}': {e}")
                    if email["received_at"]:
                        _last_poll_time = email["received_at"]
        except Exception as e:
            logger.error(f"Poll loop error: {e}")
        await asyncio.sleep(settings.poll_interval_seconds)
