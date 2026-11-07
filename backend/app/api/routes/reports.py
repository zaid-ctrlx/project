from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.event import Event
from app.models.report import Report
from app.models.user import User
from app.schemas.report import ReportCreate, ReportOut

router = APIRouter(prefix="/reports", tags=["reports"])

# Cap how many reports one account can file per hour. Stored in the DB (not in
# memory) so it survives restarts and works with several server processes.
MAX_REPORTS_PER_HOUR = 10


@router.post("", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
def create_report(
    payload: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportOut:
    if payload.target_type == "user":
        if payload.target_id == current_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't report yourself")
        if db.get(User, payload.target_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    else:
        event = db.get(Event, payload.target_id)
        if event is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
        if event.creator_id == current_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't report your own post")

    existing = db.scalar(
        select(Report.id).where(
            Report.reporter_id == current_user.id,
            Report.target_type == payload.target_type,
            Report.target_id == payload.target_id,
        )
    )
    if existing is not None:
        return ReportOut(result="already_reported")

    since = datetime.now(timezone.utc) - timedelta(hours=1)
    recent = db.scalar(
        select(func.count()).select_from(Report).where(Report.reporter_id == current_user.id, Report.created_at >= since)
    )
    if (recent or 0) >= MAX_REPORTS_PER_HOUR:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many reports. Try again later.")

    details = payload.details.strip() if payload.details else None
    db.add(
        Report(
            reporter_id=current_user.id,
            target_type=payload.target_type,
            target_id=payload.target_id,
            reason=payload.reason,
            details=details or None,
        )
    )
    db.commit()
    return ReportOut(result="created")
