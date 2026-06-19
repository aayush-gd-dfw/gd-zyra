import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, Text, TIMESTAMP, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, default="employee")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)


class ZyraCall(Base):
    __tablename__ = "zyra_calls"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    graph_message_id: Mapped[Optional[str]] = mapped_column(String, unique=True, nullable=True)
    email_subject: Mapped[Optional[str]] = mapped_column(String)
    received_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    raw_body: Mapped[Optional[str]] = mapped_column(Text)
    customer_type: Mapped[Optional[str]] = mapped_column(String)
    customer_status: Mapped[Optional[str]] = mapped_column(String)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    customer_phone: Mapped[Optional[str]] = mapped_column(String)
    ai_processed: Mapped[bool] = mapped_column(Boolean, default=False)
    assigned_to_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)
    assigned_to_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    task_status: Mapped[str] = mapped_column(String, default="To Do", nullable=False, server_default="To Do")
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)


class AssignmentRule(Base):
    __tablename__ = "assignment_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)   # 'Auto', 'Retail', or NULL
    customer_status: Mapped[Optional[str]] = mapped_column(String, nullable=True) # 'New', 'Existing', or NULL
    employee_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)
    employee_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
