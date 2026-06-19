"""Look up assignment rule for a call and return (employee_id, employee_name) or (None, None)."""
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import AssignmentRule

logger = logging.getLogger(__name__)


async def get_auto_assignment(customer_type, customer_status, db: AsyncSession):
    """Find best matching rule: exact match > type-only > status-only > default (both None)."""
    candidates = [
        (customer_type, customer_status),
        (customer_type, None),
        (None, customer_status),
        (None, None),
    ]
    for ct, cs in candidates:
        result = await db.execute(
            select(AssignmentRule)
            .where(AssignmentRule.customer_type == ct)
            .where(AssignmentRule.customer_status == cs)
        )
        rule = result.scalar_one_or_none()
        if rule and rule.employee_id:
            logger.info(f"Auto-assign: type={ct} status={cs} -> {rule.employee_name}")
            return rule.employee_id, rule.employee_name
    return None, None
