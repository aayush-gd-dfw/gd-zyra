"""
Employee management endpoints — admin/manager only.
Allows creating, editing, deactivating/reactivating staff.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from passlib.context import CryptContext
from database import get_db
from models import Employee
from auth import get_current_user

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _hash(plain: str) -> str:
    return _pwd.hash(plain)

router = APIRouter(prefix="/api/employees", tags=["employees"])


def _require_manager(current_user: Employee):
    if current_user.role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager or admin access required")


def _emp_dict(e: Employee) -> dict:
    return {
        "id": e.id,
        "name": e.name,
        "username": e.username,
        "email": e.email,
        "role": e.role,
        "is_active": e.is_active,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


@router.get("")
async def list_employees(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """List all employees (active and inactive). Manager/admin only."""
    _require_manager(current_user)
    result = await db.execute(select(Employee).order_by(Employee.name))
    return [_emp_dict(e) for e in result.scalars().all()]


class CreateEmployeeBody(BaseModel):
    name: str
    username: str
    email: str
    password: str
    role: str = "employee"  # "employee" | "manager" | "admin"


@router.post("")
async def create_employee(
    body: CreateEmployeeBody,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Create a new employee account. Manager/admin only."""
    _require_manager(current_user)

    username = body.username.strip().lower()
    email = body.email.strip().lower()

    dup_user = await db.execute(select(Employee).where(Employee.username == username))
    if dup_user.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already taken")

    dup_email = await db.execute(select(Employee).where(Employee.email == email))
    if dup_email.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already in use")

    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    emp = Employee(
        name=body.name.strip(),
        email=email,
        username=username,
        password_hash=_hash(body.password),
        role=body.role,
        is_active=True,
    )
    db.add(emp)
    await db.commit()
    await db.refresh(emp)
    return _emp_dict(emp)


class UpdateEmployeeBody(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None   # provide to reset password
    is_active: Optional[bool] = None


@router.patch("/{employee_id}")
async def update_employee(
    employee_id: str,
    body: UpdateEmployeeBody,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Edit name, role, password, or active status. Manager/admin only."""
    _require_manager(current_user)

    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    if body.name is not None:
        emp.name = body.name.strip()
    if body.email is not None:
        new_email = body.email.strip().lower()
        dup = await db.execute(
            select(Employee).where(Employee.email == new_email, Employee.id != employee_id)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Email already in use")
        emp.email = new_email
    if body.role is not None:
        emp.role = body.role
    if body.is_active is not None:
        emp.is_active = body.is_active
    if body.password is not None:
        if len(body.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        emp.password_hash = _hash(body.password)

    await db.commit()
    await db.refresh(emp)
    return _emp_dict(emp)
