import asyncio
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import AssignmentRule, Employee
from auth import get_current_user
from services.teams_notify import notify_rule_assignment

router = APIRouter(prefix="/api/rules", tags=["rules"])

def _rule_dict(r: AssignmentRule) -> dict:
    return {
        "id": r.id,
        "customer_type": r.customer_type,
        "customer_status": r.customer_status,
        "employee_id": r.employee_id,
        "employee_name": r.employee_name,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }

async def _all_rules(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(AssignmentRule).order_by(
            AssignmentRule.customer_type.nullslast(),
            AssignmentRule.customer_status.nullslast(),
        )
    )
    return [_rule_dict(r) for r in result.scalars().all()]

@router.get("")
async def list_rules(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Return all assignment rules sorted by customer_type, customer_status."""
    return await _all_rules(db)

class UpsertRuleBody(BaseModel):
    customer_type: Optional[str] = None  # 'Auto', 'Retail', or null
    customer_status: Optional[str] = None  # 'New', 'Existing', or null
    employee_id: Optional[str] = None  # UUID string or null to clear/delete

@router.put("")
async def upsert_rule(
    body: UpsertRuleBody,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """
    Upsert an assignment rule by (customer_type, customer_status).
    - If employee_id is None: delete the matching rule (clear assignment).
    - If employee_id is provided: insert or update the rule with the employee.
    Returns the full updated list of all rules.
    Fires a Teams DM to the newly assigned employee (non-blocking).
    """
    emp = None
    if body.employee_id:
        emp_result = await db.execute(
            select(Employee).where(Employee.id == body.employee_id)
        )
        emp = emp_result.scalar_one_or_none()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")

    existing_result = await db.execute(
        select(AssignmentRule)
        .where(AssignmentRule.customer_type == body.customer_type)
        .where(AssignmentRule.customer_status == body.customer_status)
    )
    existing = existing_result.scalar_one_or_none()

    should_notify = False

    if body.employee_id is None:
        if existing:
            await db.delete(existing)
            await db.commit()
    elif existing:
        if existing.employee_id != body.employee_id:
            should_notify = True
        existing.employee_id = body.employee_id
        existing.employee_name = emp.name
        existing.updated_at = datetime.now(timezone.utc)
        await db.commit()
    else:
        new_rule = AssignmentRule(
            customer_type=body.customer_type,
            customer_status=body.customer_status,
            employee_id=body.employee_id,
            employee_name=emp.name,
            updated_at=datetime.now(timezone.utc),
        )
        db.add(new_rule)
        await db.commit()
        should_notify = True

    if should_notify and emp:
        asyncio.create_task(
            notify_rule_assignment(
                employee_email=emp.email,
                employee_name=emp.name,
                customer_type=body.customer_type,
                customer_status=body.customer_status,
            )
        )

    return await _all_rules(db)

@router.get("/employees")
async def list_rule_employees(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Return active employees (id, name, role) for populating rule dropdowns."""
    result = await db.execute(
        select(Employee).where(Employee.is_active == True).order_by(Employee.name)
    )
    return [{"id": e.id, "name": e.name, "role": e.role} for e in result.scalars().all()]
