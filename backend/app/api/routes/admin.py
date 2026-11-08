"""Moderator endpoints. Everything here requires users.is_admin, which can only
be granted from the server (scripts/make_admin.py) - there is deliberately no
API that sets it, so an account can never promote itself."""
import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.event import Event
from app.models.report import Report
from app.models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        # 404, not 403: don't advertise that an admin area exists.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return current_user


class AdminReportOut(BaseModel):
    id: uuid.UUID
    created_at: datetime
    reason: str
    details: str | None
    status: str
    reporter_id: uuid.UUID
    reporter_username: str | None
    target_type: str
    target_id: uuid.UUID
    # Human-readable: "@name" for a user, the title for a post; None if the
    # target has since been deleted.
    target_label: str | None
    target_kind: str | None  # "event" | "community" for posts
    # How many reports (any status) point at this same target.
    target_report_count: int


class ReportStatusUpdate(BaseModel):
    status: Literal["open", "resolved"]


def _to_out(db: Session, r: Report) -> AdminReportOut:
    reporter = db.get(User, r.reporter_id)
    label = kind = None
    if r.target_type == "user":
        t = db.get(User, r.target_id)
        label = f"@{t.username}" if t else None
    else:
        e = db.get(Event, r.target_id)
        if e:
            label, kind = e.title, e.kind
    same_target = len(db.scalars(select(Report.id).where(Report.target_id == r.target_id)).all())
    return AdminReportOut(
        id=r.id,
        created_at=r.created_at,
        reason=r.reason,
        details=r.details,
        status=r.status,
        reporter_id=r.reporter_id,
        reporter_username=reporter.username if reporter else None,
        target_type=r.target_type,
        target_id=r.target_id,
        target_label=label,
        target_kind=kind,
        target_report_count=same_target,
    )


@router.get("/reports", response_model=list[AdminReportOut])
def list_reports(
    report_status: Literal["open", "resolved", "all"] = Query(default="open", alias="status"),
    limit: int = Query(default=100, ge=1, le=200),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AdminReportOut]:
    stmt = select(Report).order_by(Report.created_at.desc()).limit(limit)
    if report_status != "all":
        stmt = stmt.where(Report.status == report_status)
    return [_to_out(db, r) for r in db.scalars(stmt).all()]


@router.put("/reports/{report_id}", response_model=AdminReportOut)
def set_report_status(
    report_id: uuid.UUID,
    payload: ReportStatusUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminReportOut:
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    report.status = payload.status
    db.commit()
    return _to_out(db, report)
