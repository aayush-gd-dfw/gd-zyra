"""
Gemini Flash extractor for Zyra call emails.
Uses google-genai SDK with gemini-3.5-flash.
"""
import logging, json, asyncio

logger = logging.getLogger(__name__)

PROMPT_PREFIX = """You are analyzing a Zyra AI call notification email for Glass Doctor DFW.
Extract info and respond with ONLY valid JSON, no markdown fences.
Example format:
{"customer_type":"Auto","customer_status":"New","summary":"Customer wants windshield replaced.","customer_phone":"(817)555-1234"}

Rules:
- customer_type: Auto=windshield/auto glass, Retail=window/door/home/shower/commercial glass, Unknown=unclear
- customer_status: New=first-time/requesting quote, Existing=calling about prior job, Unknown=unclear
- summary: 1-2 sentences on what the customer needs, no mention of Zyra or AI
- customer_phone: US phone with dashes/parens, empty string if not found

EMAIL TO ANALYZE:
"""

async def extract_call_info(body: str):
    try:
        from google import genai
        from config import get_settings
        settings = get_settings()
        if not settings.gemini_api_key:
            return None
        client = genai.Client(api_key=settings.gemini_api_key)
        prompt = PROMPT_PREFIX + body[:6000]
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.models.generate_content(model="gemini-3.5-flash", contents=prompt)
        )
        raw = response.text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"): raw = raw[4:]
            raw = raw.strip()
        data = json.loads(raw)
        ct = str(data.get("customer_type","")).strip()
        cs = str(data.get("customer_status","")).strip()
        return {
            "customer_type": ct if ct in ("Auto","Retail","Unknown") else "Unknown",
            "customer_status": cs if cs in ("New","Existing","Unknown") else "Unknown",
            "summary": str(data.get("summary","")).strip() or None,
            "customer_phone": str(data.get("customer_phone","")).strip() or None,
        }
    except Exception as e:
        logger.warning(f"Gemini extraction error: {e}")
        return None
