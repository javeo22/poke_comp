"""Admin endpoints for data health monitoring.

Provides a read-only data health check endpoint that runs the same
validation checks as scripts/validate_data.py without modifying data.
"""

from fastapi import APIRouter

from app.database import supabase
from scripts.validate_data import run_validation

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/data-health")
def data_health():
    """Run data validation checks and return a health report.

    This is a read-only endpoint -- it never modifies data.
    """
    report = run_validation(supabase, fix=False)
    result = report.to_dict()
    result["overall"] = "healthy" if report.total_issues == 0 else "degraded"
    return result
