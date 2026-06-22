import asyncio
from typing import Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import ZyraCall, Employee
from auth import get_current_user
from services.teams_notifier import notify_assignment
from services.teams_notify import notify_call_assignment

router = APIRouter(prefix="/api/calls", tags=["calls"])

def _call_dict(c: ZyraCall) -> dict:
    return {
        "id": c.id,
        "email_subject": c.email_subject,
        "received_at": c.received_at.isoformat() if c.received_at else None,
        "customer_type": c.customer_type,
        "customer_status": c.customer_status,
        "summary": c.summary,
        "customer_phone": c.customer_phone,
        "ai_processed": c.ai_processed,
        "assigned_to_id": c.assigned_to_id,
        "assigned_to_name": c.assigned_to_name,
        "task_status": c.task_status or "To Do",
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "raw_body": c.raw_body,
    }

@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    total_r = await db.execute(select(func.count()).select_from(ZyraCall))
    today_r = await db.execute(select(func.count()).select_from(ZyraCall).where(ZyraCall.received_at >= today_start))
    auto_r = await db.execute(select(func.count()).select_from(ZyraCall).where(ZyraCall.received_at >= today_start, ZyraCall.customer_type == "Auto"))
    retail_r = await db.execute(select(func.count()).select_from(ZyraCall).where(ZyraCall.received_at >= today_start, ZyraCall.customer_type == "Retail"))
    new_r = await db.execute(select(func.count()).select_from(ZyraCall).where(ZyraCall.received_at >= today_start, ZyraCall.customer_status == "New"))
    today = today_r.scalar()
    new_count = new_r.scalar()
    return {
        "total_all_time": total_r.scalar(),
        "today_total": today,
        "today_auto": auto_r.scalar(),
        "today_retail": retail_r.scalar(),
        "today_new": new_count,
        "today_existing": today - new_count,
    }

@router.get("/employees")
async def list_employees(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(Employee).where(Employee.is_active == True).order_by(Employee.name)
    )
    return [{"id": e.id, "name": e.name, "role": e.role} for e in result.scalars().all()]

@router.get("")
async def list_calls(
    customer_type: Optional[str] = Query(None),
    customer_status: Optional[str] = Query(None),
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    q = select(ZyraCall).where(ZyraCall.received_at >= cutoff)
    if customer_type:
        q = q.where(ZyraCall.customer_type == customer_type)
    if customer_status:
        q = q.where(ZyraCall.customer_status == customer_status)
    q = q.order_by(ZyraCall.received_at.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    return [_call_dict(c) for c in result.scalars().all()]

@router.get("/{call_id}")
async def get_call(
    call_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(select(ZyraCall).where(ZyraCall.id == call_id))
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return _call_dict(call)

VALID_TASK_STATUSES = {"To Do", "In Progress", "Complete"}

class TaskStatusBody(BaseModel):
    task_status: str

@router.patch("/{call_id}/status")
async def update_task_status(
    call_id: str,
    body: TaskStatusBody,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if body.task_status not in VALID_TASK_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {VALID_TASK_STATUSES}")
    result = await db.execute(select(ZyraCall).where(ZyraCall.id == call_id))
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    call.task_status = body.task_status
    await db.commit()
    await db.refresh(call)
    return _call_dict(call)

class AssignBody(BaseModel):
    employee_id: Optional[str] = None

@router.patch("/{call_id}/assign")
async def assign_call(
    call_id: str,
    body: AssignBody,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(select(ZyraCall).where(ZyraCall.id == call_id))
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    prev_assigned_id = call.assigned_to_id

    emp = None
    if body.employee_id:
        emp_r = await db.execute(select(Employee).where(Employee.id == body.employee_id))
        emp = emp_r.scalar_one_or_none()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        call.assigned_to_id = emp.id
        call.assigned_to_name = emp.name
    else:
        call.assigned_to_id = None
        call.assigned_to_name = None

    await db.commit()
    await db.refresh(call)

    # Only notify when assigning to a different employee (not unassigning, not same person)
    if emp and body.employee_id != prev_assigned_id:
        # Channel webhook notification (existing)
        await notify_assignment(
            emp.name,
            call.customer_phone,
            call.customer_type,
            call.customer_status,
            call.summary,
        )
        # 1:1 Teams DM notification
        asyncio.create_task(
            notify_call_assignment(
                employee_email=emp.email,
                employee_name=emp.name,
                customer_phone=call.customer_phone,
                customer_type=call.customer_type,
                customer_status=call.customer_status,
            )
        )

    return _call_dict(call)
