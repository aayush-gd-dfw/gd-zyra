"""
Reprocess all existing unprocessed calls using text_extractor and auto-assign via rules.
Run with: docker exec gd-zyra-backend-1 python3 /app/reprocess_calls.py
"""
import asyncio, sys
sys.path.insert(0, "/app")
from database import AsyncSessionLocal
from models import ZyraCall
from services.text_extractor import extract_call_info_from_text
from services.assignment_engine import get_auto_assignment
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(ZyraCall).where(ZyraCall.ai_processed == False))
        calls = result.scalars().all()
        print(f"Found {len(calls)} unprocessed calls")
        for call in calls:
            if not call.raw_body:
                continue
            extracted = extract_call_info_from_text(call.raw_body)
            call.customer_type   = extracted.get("customer_type") or call.customer_type
            call.customer_status = extracted.get("customer_status") or call.customer_status
            call.summary         = extracted.get("summary") or call.summary
            call.customer_phone  = extracted.get("customer_phone") or call.customer_phone
            call.ai_processed    = bool(call.customer_type)
            # Auto-assign if not yet assigned
            if not call.assigned_to_id and call.customer_type:
                emp_id, emp_name = await get_auto_assignment(call.customer_type, call.customer_status, db)
                if emp_id:
                    call.assigned_to_id = emp_id
                    call.assigned_to_name = emp_name
            print(f"  {call.id[:8]}: type={call.customer_type} status={call.customer_status} phone={call.customer_phone} assigned={call.assigned_to_name}")
        await db.commit()
        print("Done.")

asyncio.run(main())
