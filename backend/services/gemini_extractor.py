"""
Gemini Flash extractor — calls Google Gemini 1.5 Flash (free tier) to extract
customer_type, customer_status, and summary from Zyra call summary emails.

Free tier: 15 requests/minute, 1M tokens/day.
Get your key at: https://aistudio.google.com/app/apikey
"""
import json
import logging
import re
import httpx
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

PROMPT_TEMPLATE = """You are processing a Zyra AI voice call summary email for Glass Doctor DFW, a glass company.

Extract exactly these 3 fields:

1. customer_type: "Auto" if the call is about vehicle/windshield/auto glass, "Retail" if about home/residential/commercial/storefront glass
2. customer_status: "New" if this is a first-time caller, "Existing" if they are an existing customer
3. summary: 2-3 sentence summary of the call. Include the customer name and phone number if mentioned.

Email content:
---
{body}
---

Respond with valid JSON only, no explanation or markdown:
{{"customer_type": "Auto or Retail", "customer_status": "New or Existing", "summary": "..."}}"""


async def extract_call_info(body: str) -> dict:
    """
    Call Gemini Flash to extract call fields from email body.
    Returns dict with customer_type, customer_status, summary.
    Falls back to empty strings on failure.
    """
    if not settings.gemini_api_key:
        logger.warning("GEMINI_API_KEY not set — AI extraction skipped")
        return {"customer_type": "", "customer_status": "", "summary": body[:500] if body else ""}

    prompt = PROMPT_TEMPLATE.format(body=body[:4000])  # cap to avoid token limits

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"{GEMINI_URL}?key={settings.gemini_api_key}",
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "temperature": 0.1,
                    },
                },
            )
            resp.raise_for_status()
            data = resp.json()

        text = data["candidates"][0]["content"]["parts"][0]["text"]
        result = json.loads(text)

        return {
            "customer_type": result.get("customer_type", "").strip(),
            "customer_status": result.get("customer_status", "").strip(),
            "summary": result.get("summary", "").strip(),
        }

    except Exception as e:
        logger.error(f"Gemini extraction failed: {e}")
        return {"customer_type": "", "customer_status": "", "summary": ""}


def extract_phone(text: str) -> str:
    """Pull first 10-digit US phone number from text."""
    m = re.search(r"(\+?1[\s.-]?)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})", text or "")
    if not m:
        return ""
    digits = re.sub(r"\D", "", m.group(0))
    if len(digits) > 10 and digits.startswith("1"):
        digits = digits[1:]
    return digits if len(digits) == 10 else ""
