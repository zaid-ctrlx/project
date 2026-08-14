import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.notification import Notification, PushToken
from app.models.user import User
from app.schemas.notification import NotificationOut, PushTokenPayload, UnreadCountOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Notification]:
    stmt = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return db.scalars(stmt).all()


@router.get("/unread-count", response_model=UnreadCountOut)
def unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UnreadCountOut:
    count = db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == current_user.id, Notification.read_at.is_(None))
    )
    return UnreadCountOut(unread_count=count or 0)


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.read_at.is_(None))
        .values(read_at=func.now())
    )
    db.commit()


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    # No existence/ownership error, mirroring mark_thread_read's style in
    # routes/messages.py — someone else's id (or a typo'd one) just updates
    # 0 rows rather than 404ing.
    db.execute(
        update(Notification)
        .where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
            Notification.read_at.is_(None),
        )
        .values(read_at=func.now())
    )
    db.commit()


@router.post("/push-token", status_code=status.HTTP_204_NO_CONTENT)
def register_push_token(
    payload: PushTokenPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    # A token belongs to one device; if it shows up again under a different
    # (or the same) account — reinstall, account switch on a shared device —
    # move it to whoever's registering it now rather than erroring, and
    # refresh created_at so it doesn't look stale. True upsert (ON CONFLICT)
    # rather than the check-then-insert/update style used elsewhere in this
    # codebase, since `token` alone (not a composite key) is the natural
    # conflict target here.
    stmt = (
        pg_insert(PushToken)
        .values(user_id=current_user.id, token=payload.token)
        .on_conflict_do_update(
            index_elements=[PushToken.token],
            set_={"user_id": current_user.id, "created_at": func.now()},
        )
    )
    db.execute(stmt)
    db.commit()


@router.delete("/push-token", status_code=status.HTTP_204_NO_CONTENT)
def unregister_push_token(
    payload: PushTokenPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    # Called on logout (best-effort) so a shared/reset device stops
    # receiving this account's pushes. Scoped to current_user too — not
    # strictly necessary since token is globally unique, but keeps this
    # endpoint from deleting a row it doesn't own if the token got
    # re-registered elsewhere in between.
    db.execute(delete(PushToken).where(PushToken.token == payload.token, PushToken.user_id == current_user.id))
    db.commit()
