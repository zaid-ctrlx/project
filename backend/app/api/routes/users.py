import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.routes.connections import connection_status, count_connections, remove_connection
from app.core.config import settings
from app.core.images import verify_image
from app.core.security import verify_password
from app.db.session import get_db
from app.models.block import UserBlock
from app.models.event import Event, event_rsvps
from app.models.group import GroupMember
from app.models.message import DmMute
from app.models.user import Tag, User
from app.schemas.user import (
    AccountDeleteRequest,
    BlockedUserOut,
    ProfileUpdate,
    UserOut,
    UserPublicOut,
    UserSearchResult,
    UserStatsOut,
)

router = APIRouter(prefix="/users", tags=["users"])

AVATAR_MAX_BYTES = 5 * 1024 * 1024  # 5MB
AVATAR_EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def _blocked_pairs(db: Session, user_id: uuid.UUID):
    """IDs of everyone `user_id` has blocked or been blocked by (either
    direction) — reused by search (exclude entirely) and messaging (deny
    sending). One small query, same style as event_bookmarks lookups."""
    rows = db.execute(
        select(UserBlock.blocker_id, UserBlock.blocked_id).where(
            or_(UserBlock.blocker_id == user_id, UserBlock.blocked_id == user_id)
        )
    ).all()
    return {other for pair in rows for other in pair if other != user_id}


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    payload: AccountDeleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect password")

    # Best-effort: clean up the avatar file on disk. Everything else (events
    # created, messages sent, group memberships, bookmarks, blocks) cascades
    # via each table's own ondelete="CASCADE" FK — see the relevant models.
    avatars_dir = Path(settings.MEDIA_ROOT) / "avatars"
    for old in avatars_dir.glob(f"{current_user.id}_*"):
        old.unlink(missing_ok=True)

    db.delete(current_user)
    db.commit()


@router.get("/search", response_model=list[UserSearchResult])
def search_users(
    q: str = Query(..., min_length=1, max_length=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[User]:
    # Deliberately minimal fields on the response (see UserSearchResult) —
    # no email, no location. Search is by username or name; browsing
    # strangers' precise location by search isn't something this endpoint
    # should ever expose.
    excluded_ids = _blocked_pairs(db, current_user.id) | {current_user.id}
    pattern = f"%{q}%"
    return db.scalars(
        select(User)
        .where(
            User.id.notin_(excluded_ids),
            or_(User.username.ilike(pattern), User.full_name.ilike(pattern)),
        )
        .order_by(func.lower(User.username))
        .limit(20)
    ).all()


@router.get("/me/blocked", response_model=list[BlockedUserOut])
def list_blocked_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[User]:
    return db.scalars(
        select(User)
        .join(UserBlock, UserBlock.blocked_id == User.id)
        .where(UserBlock.blocker_id == current_user.id)
        .order_by(func.lower(User.username))
    ).all()


@router.post("/{user_id}/block", status_code=status.HTTP_204_NO_CONTENT)
def block_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't block yourself")
    if db.get(User, user_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Idempotent, matching bookmark_event's style in routes/events.py.
    already = db.execute(
        select(UserBlock).where(UserBlock.blocker_id == current_user.id, UserBlock.blocked_id == user_id)
    ).scalar_one_or_none()
    if already is None:
        db.add(UserBlock(blocker_id=current_user.id, blocked_id=user_id))
    # Blocking someone ends any connection or pending request between you.
    remove_connection(db, current_user.id, user_id)
    db.commit()


@router.delete("/{user_id}/block", status_code=status.HTTP_204_NO_CONTENT)
def unblock_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    db.execute(delete(UserBlock).where(UserBlock.blocker_id == current_user.id, UserBlock.blocked_id == user_id))
    db.commit()


@router.post("/{user_id}/mute", status_code=status.HTTP_204_NO_CONTENT)
def mute_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    # Same shape as block_user above — idempotent, 400 on muting yourself,
    # 404 on a nonexistent target. One-directional only (see DmMute's
    # docstring) — no "both sides" check like _blocked_pairs does for
    # blocking.
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't mute yourself")
    if db.get(User, user_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    already = db.execute(
        select(DmMute).where(DmMute.user_id == current_user.id, DmMute.other_user_id == user_id)
    ).scalar_one_or_none()
    if already is None:
        db.add(DmMute(user_id=current_user.id, other_user_id=user_id))
        db.commit()


@router.delete("/{user_id}/mute", status_code=status.HTTP_204_NO_CONTENT)
def unmute_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    db.execute(delete(DmMute).where(DmMute.user_id == current_user.id, DmMute.other_user_id == user_id))
    db.commit()


@router.put("/me/profile", response_model=UserOut)
def update_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    existing = db.scalar(
        select(User).where(User.username == payload.username, User.id != current_user.id)
    )
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")

    if payload.tag_ids:
        tags = db.scalars(select(Tag).where(Tag.id.in_(payload.tag_ids))).all()
        found_ids = {tag.id for tag in tags}
        missing = set(payload.tag_ids) - found_ids
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown tag id(s): {', '.join(str(t) for t in missing)}",
            )
        current_user.tags = tags
    else:
        current_user.tags = []

    current_user.full_name = payload.full_name
    current_user.username = payload.username
    current_user.bio = payload.bio
    current_user.gender = payload.gender
    if payload.location_lat is not None and payload.location_lng is not None:
        current_user.location_lat = payload.location_lat
        current_user.location_lng = payload.location_lng
        current_user.location_label = payload.location_label
    current_user.onboarding_completed = True

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    if file.content_type not in AVATAR_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPEG, PNG, or WEBP images are allowed",
        )

    contents = await file.read()
    if len(contents) > AVATAR_MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image must be under 5MB")
    verify_image(contents, file.content_type)

    avatars_dir = Path(settings.MEDIA_ROOT) / "avatars"
    avatars_dir.mkdir(parents=True, exist_ok=True)

    # Old avatar(s) for this user are removed before writing the new one —
    # and the new filename gets a fresh random suffix (rather than reusing a
    # fixed per-user name) so cached copies of the old image on-device don't
    # get mistaken for the new one at the same URL.
    for old in avatars_dir.glob(f"{current_user.id}_*"):
        old.unlink(missing_ok=True)

    ext = AVATAR_EXTENSIONS[file.content_type]
    filename = f"{current_user.id}_{uuid.uuid4().hex[:8]}.{ext}"
    (avatars_dir / filename).write_bytes(contents)

    current_user.avatar_url = f"/media/avatars/{filename}"
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


# "/{user_id}/stats" has an extra path segment, so it can't be swallowed by the
# bare "/{user_id}" route below; the app passes its own id for "my" stats.
@router.get("/{user_id}/stats", response_model=UserStatsOut)
def read_user_stats(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserStatsOut:
    if db.get(User, user_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    hosted = db.scalar(select(func.count()).select_from(Event).where(Event.creator_id == user_id)) or 0
    communities_joined = db.scalar(
        select(func.count())
        .select_from(GroupMember)
        .join(Event, Event.group_id == GroupMember.group_id)
        .where(GroupMember.user_id == user_id, Event.kind == "community", Event.creator_id != user_id)
    ) or 0
    events_attended = db.scalar(
        select(func.count())
        .select_from(event_rsvps)
        .join(Event, Event.id == event_rsvps.c.event_id)
        .where(event_rsvps.c.user_id == user_id, Event.starts_at < datetime.now(timezone.utc))
    ) or 0
    return UserStatsOut(
        hosted=hosted,
        communities_joined=communities_joined,
        events_attended=events_attended,
        connections=count_connections(db, user_id),
    )


# Registered last (and after the /me, /search literal paths above) so it
# never shadows them — "me" or "search" would otherwise be swallowed here
# as an (invalid) {user_id} first, per FastAPI's registration-order matching.
@router.get("/{user_id}", response_model=UserPublicOut)
def read_user_profile(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_blocked = db.execute(
        select(UserBlock).where(UserBlock.blocker_id == current_user.id, UserBlock.blocked_id == user_id)
    ).scalar_one_or_none() is not None
    user.is_muted = db.execute(
        select(DmMute).where(DmMute.user_id == current_user.id, DmMute.other_user_id == user_id)
    ).scalar_one_or_none() is not None
    user.connection_status = connection_status(db, current_user.id, user_id)
    return user
