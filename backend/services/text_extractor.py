"""
Regex-based extractor for Zyra AI call summary emails.
Used as primary extractor (or fallback when no Gemini key).
"""
import re
import logging

logger = logging.getLogger(__name__)

# Keywords that suggest Auto (windshield / vehicle) vs Retail (residential / home)
AUTO_KEYWORDS = [
    "windshield", "auto glass", "vehicle", "car ", "truck", "chip",
    "crack in the windshield", "adas", "calibration", "rock chip",
    "auto claim", "insurance claim", "rear window", "back glass",
    "side window", "driver side", "passenger side", "door glass auto",
]
RETAIL_KEYWORDS = [
    "residential", "home", "house", "shower", "storefront",
    "commercial", "office", "building", "screen repair",
    "mirror", "table top", "glass table", "patio door",
    "sliding door", "french door", "window repair", "window replacement",
    "glass repair", "glass replacement",
]

# Customer status signals
# NOTE: keep these specific — Zyra's routing script always contains the phrase
# "residential existing job customer, or residential new job customer" in every transcript,
# so bare words like "existing" or "new" fire on every call.
EXISTING_SIGNALS = [
    "existing customer",
    "returning customer",
    "return customer",
    "already a customer",
    "past customer",
    "previous customer",
    "existing client",
    "came back",
    "called before",
    "we've worked with",
    "had service",
    "prior service",
    "prior job",
    "previous job",
    "previous service",
    "previous visit",
    "follow up on",
    "follow-up on",
    "question about her job",        # e.g. "has a question about her existing job"
    "question about his job",
    "question about their job",
    "about an existing",             # "calling about an existing job/order"
]
NEW_SIGNALS = [
    "requesting a quote",
    "get a quote",
    "new customer",
    "new lead",
    "new inquiry",
    "new request",
    "first time",
    "never used",
    "never called",
    "potential customer",
    "prospective customer",
    "new prospect",
    "new job",                       # only when not preceded by "existing"
]


def extract_summary(body: str) -> str | None:
    """Pull the summary paragraph from the Zyra email body."""
    # Look for the paragraph after "Summary of the completed phone call as below:"
    m = re.search(
        r"summary of the completed phone call as below[:\s]*\n+(.+?)(?:\n\s*\n|customer called from|please see your call transcript)",
        body,
        re.IGNORECASE | re.DOTALL,
    )
    if m:
        return m.group(1).strip()

    # Fallback: grab first substantial paragraph after "Hi Glass Doctor"
    m = re.search(r"Hi Glass Doctor[^\n]*\n+([^\n]{80,})", body, re.IGNORECASE)
    if m:
        return m.group(1).strip()

    return None


def extract_phone(text: str) -> str | None:
    """Find phone number in text, prefer the 'Customer called from' line."""
    if not text:
        return None

    # Prefer "Customer called from: (972)677-7598"
    m = re.search(r"customer called from[:\s]+\(?(\d{3})\)?[\s\-.]?(\d{3})[\s\-.]?(\d{4})", text, re.IGNORECASE)
    if m:
        return f"({m.group(1)}){m.group(2)}-{m.group(3)}"

    # General phone pattern
    m = re.search(r"\(?\b(\d{3})\)?[\s\-.]?(\d{3})[\s\-.]?(\d{4})\b", text)
    if m:
        return f"({m.group(1)}){m.group(2)}-{m.group(3)}"

    return None


def detect_customer_type(text: str) -> str | None:
    """Auto or Retail based on keywords. High-value terms score 2, others score 1."""
    lower = text.lower()

    HIGH_AUTO   = {"windshield", "auto glass", "rock chip", "adas", "calibration"}
    HIGH_RETAIL = {"residential", "storefront", "shower", "patio door", "sliding door", "french door"}

    auto_score = sum(
        (2 if kw in HIGH_AUTO else 1) for kw in AUTO_KEYWORDS if kw in lower
    )
    retail_score = sum(
        (2 if kw in HIGH_RETAIL else 1) for kw in RETAIL_KEYWORDS if kw in lower
    )

    if auto_score > retail_score:
        return "Auto"
    if retail_score > auto_score:
        return "Retail"
    return None  # ambiguous


def detect_customer_status(text: str) -> str | None:
    """New or Existing based on keywords. Existing takes priority."""
    lower = text.lower()
    if any(s in lower for s in EXISTING_SIGNALS):
        return "Existing"
    # For NEW_SIGNALS, skip "new job" if "existing" appears right before it
    # (catches Zyra's routing script: "existing job customer, or residential new job customer")
    for signal in NEW_SIGNALS:
        if signal in lower:
            if signal == "new job":
                idx = lower.find("new job")
                context = lower[max(0, idx - 20):idx]
                if "existing" in context:
                    continue  # "existing ... new job" — skip, it's Zyra's script
            return "New"
    return None


def extract_call_info_from_text(body: str) -> dict:
    """Full extraction from raw email body — no AI needed."""
    summary        = extract_summary(body)
    phone          = extract_phone(body)

    # Use full body for TYPE detection (more signal), but ONLY the summary for STATUS.
    # Reason: Zyra's routing script always contains "residential existing job customer /
    # residential new job customer", which causes false status matches if we scan the body.
    type_text   = (summary or "") + " " + body
    status_text = summary or body   # prefer summary; fall back to body only if no summary

    customer_type   = detect_customer_type(type_text)
    customer_status = detect_customer_status(status_text)

    logger.info(
        f"Text extractor: type={customer_type} status={customer_status} "
        f"phone={phone} summary_len={len(summary or '')}"
    )
    return {
        "summary":         summary,
        "customer_phone":  phone,
        "customer_type":   customer_type,
        "customer_status": customer_status,
    }
