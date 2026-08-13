import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import delete, exists, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.event import Event, event_bookmarks
from app.models.group import ChatGroup, GroupMember
from app.models.user import User
from app.schemas.event import EVENT_KIND_OPTIONS, JOIN_POLICY_OPTIONS, EventCreate, EventOut

router = APIRouter(prefix="/events", tags=["events"])

# Same allowlist/size cap as the user-avatar/group-avatar uploads (see
# routes/users.py, routes/groups.py).
COVER_MAX_BYTES = 5 * 1024 * 1024  # 5MB
COVER_EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def _with_bookmark_flag(stmt, current_user_id: uuid.UUID):
    """Adds a correlated EXISTS(...) column so each row's bookmark state for
    the current user is computed in one query instead of N+1 lookups."""
    return stmt.add_columns(
        exists().where(
            event_bookmarks.c.event_id == Event.id,
            event_bookmarks.c.user_id == current_user_id,
        )
    )


def _with_join_flags(stmt, current_user_id: uuid.UUID):
    """Adds is_joined (correlated EXISTS on GroupMember for the current
    user) and member_count (correlated COUNT of GroupMember rows) columns —
    same "compute in the query, not N+1" approach as _with_bookmark_flag.
    Both naturally evaluate to False/0 for kind="event" rows: Event.group_id
    is NULL there, and comparing a GroupMember column against a NULL never
    matches in SQL, so no kind check is needed here."""
    return stmt.add_columns(
        exists().where(GroupMember.group_id == Event.group_id, GroupMember.user_id == current_user_id),
        select(func.count()).select_from(GroupMember).where(GroupMember.group_id == Event.group_id).scalar_subquery(),
    )


def _set_event_flags(db: Session, event: Event, current_user_id: uuid.UUID) -> None:
    """Sets is_bookmarked/is_joined/member_count on an already-persisted
    event for the single-row endpoints (these aren't mapped columns — see
    the comment on EventOut). List endpoints compute the same three via
    _with_bookmark_flag/_with_join_flags instead, in the query itself."""
    event.is_bookmarked = db.execute(
        select(exists().where(event_bookmarks.c.event_id == event.id, event_bookmarks.c.user_id == current_user_id))
    ).scalar_one()
    if event.group_id is None:
        event.is_joined = False
        event.member_count = 0
    else:
        event.is_joined = db.execute(
            select(exists().where(GroupMember.group_id == event.group_id, GroupMember.user_id == current_user_id))
        ).scalar_one()
        event.member_count = db.execute(
            select(func.count()).select_from(GroupMember).where(GroupMember.group_id == event.group_id)
        ).scalar_one()


def _create_community_group(db: Session, title: str, creator_id: uuid.UUID) -> uuid.UUID:
    """Creates the ChatGroup that backs a community's membership/chat, with
    the creator as its sole admin — same shape as create_group in
    routes/groups.py. Returns the new group's id to stash on Event.group_id.
    Used both at community-creation time and lazily by join_community for
    any pre-existing community row that predates group_id."""
    group = ChatGroup(id=uuid.uuid4(), name=title, creator_id=creator_id)
    db.add(group)
    db.add(GroupMember(group_id=group.id, user_id=creator_id, role="admin"))
    # Flush now so the group row exists before the caller sets Event.group_id
    # and flushes/commits *that* — group_id has no ORM relationship telling
    # SQLAlchemy's unit-of-work about the dependency, so without this the
    # events INSERT/UPDATE can be ordered before the chat_groups INSERT and
    # trip the FK constraint.
    db.flush()
    return group.id


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: EventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Event:
    # payload.starts_at is only set for kind="event" (enforced by
    # EventCreate's validator) — communities have no date to check.
    if payload.kind == "event" and payload.starts_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Event must start in the future")

    event = Event(
        kind=payload.kind,
        title=payload.title,
        description=payload.description,
        starts_at=payload.starts_at,
        frequency=payload.frequency,
        is_online=payload.is_online,
        location_lat=payload.location_lat,
        location_lng=payload.location_lng,
        location_label=payload.location_label,
        join_policy=payload.join_policy,
        activity_type=payload.activity_type,
        creator_id=current_user.id,
    )
    if payload.kind == "community":
        # "Joining" a community is membership in this linked group — see
        # Event.group_id and _create_community_group above.
        event.group_id = _create_community_group(db, payload.title, current_user.id)

    db.add(event)
    db.commit()
    db.refresh(event)
    event.creator = current_user
    _set_event_flags(db, event, current_user.id)
    return event


@router.get("", response_model=list[EventOut])
def list_events(
    q: str | None = Query(default=None, min_length=1, max_length=100),
    kind: EVENT_KIND_OPTIONS | None = Query(default=None),
    join_policy: JOIN_POLICY_OPTIONS | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Event]:
    stmt = select(Event).options(selectinload(Event.creator))
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(or_(Event.title.ilike(pattern), Event.description.ilike(pattern)))
    # Omitted = both kinds (Home's "All") — mobile's Filter chip now cycles
    # kind (All/Event/Community) instead of join_policy; join_policy stays
    # queryable here (still a real column) even though nothing sends it today.
    if kind:
        stmt = stmt.where(Event.kind == kind)
    if join_policy:
        stmt = stmt.where(Event.join_policy == join_policy)
    stmt = _with_bookmark_flag(stmt, current_user.id)
    stmt = _with_join_flags(stmt, current_user.id).order_by(Event.created_at.desc()).limit(limit).offset(offset)

    events: list[Event] = []
    for event, bookmarked, joined, member_count in db.execute(stmt).all():
        event.is_bookmarked = bookmarked
        event.is_joined = joined
        event.member_count = member_count
        events.append(event)
    return events


# Declared before /events/{event_id}/... so "bookmarks" is never captured as
# a path parameter (no actual collision today — different segment counts —
# but keeps this safe if a detail route is ever added).
@router.get("/bookmarks", response_model=list[EventOut])
def list_bookmarked_events(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Event]:
    stmt = (
        select(Event)
        .options(selectinload(Event.creator))
        .join(event_bookmarks, event_bookmarks.c.event_id == Event.id)
        .where(event_bookmarks.c.user_id == current_user.id)
    )
    stmt = _with_join_flags(stmt, current_user.id).order_by(Event.created_at.desc())

    events: list[Event] = []
    for event, joined, member_count in db.execute(stmt).all():
        event.is_bookmarked = True  # guaranteed by the join above
        event.is_joined = joined
        event.member_count = member_count
        events.append(event)
    return events


@router.get("/mine", response_model=list[EventOut])
def list_my_events(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Event]:
    stmt = select(Event).options(selectinload(Event.creator)).where(Event.creator_id == current_user.id)
    stmt = _with_bookmark_flag(stmt, current_user.id)
    stmt = _with_join_flags(stmt, current_user.id).order_by(Event.created_at.desc())

    events: list[Event] = []
    for event, bookmarked, joined, member_count in db.execute(stmt).all():
        event.is_bookmarked = bookmarked
        event.is_joined = joined
        event.member_count = member_count
        events.append(event)
    return events


def _get_own_event(db: Session, event_id: uuid.UUID, current_user: User) -> Event:
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if event.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the event's creator can do that")
    return event


def _get_community(db: Session, event_id: uuid.UUID) -> Event:
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if event.kind != "community":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only communities can be joined")
    return event


@router.post("/{event_id}/cover", response_model=EventOut)
async def upload_event_cover(
    event_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Event:
    # Same validation/storage shape as POST /groups/{id}/avatar — separate
    # endpoint (not folded into EventCreate) because the event needs to
    # exist first to have an id to save the file under; the mobile client
    # calls this right after POST /events succeeds, from the same
    # "Create event/community" button press (see EventForm).
    event = _get_own_event(db, event_id, current_user)

    if file.content_type not in COVER_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPEG, PNG, or WEBP images are allowed",
        )

    contents = await file.read()
    if len(contents) > COVER_MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image must be under 5MB")

    covers_dir = Path(settings.MEDIA_ROOT) / "event_covers"
    covers_dir.mkdir(parents=True, exist_ok=True)

    for old in covers_dir.glob(f"{event_id}_*"):
        old.unlink(missing_ok=True)

    ext = COVER_EXTENSIONS[file.content_type]
    filename = f"{event_id}_{uuid.uuid4().hex[:8]}.{ext}"
    (covers_dir / filename).write_bytes(contents)

    event.cover_image_url = f"/media/event_covers/{filename}"
    db.add(event)
    db.commit()
    db.refresh(event)
    _set_event_flags(db, event, current_user.id)
    return event


@router.put("/{event_id}", response_model=EventOut)
def update_event(
    event_id: uuid.UUID,
    payload: EventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Event:
    # Full replace (not a partial PATCH) — matches how the mobile form
    # submits it: EventForm always sends every field, prefilled from the
    # event being edited, same shape as create_event's payload. Editing
    # never changes an event's kind (EventForm doesn't offer that) but
    # nothing here enforces it — a same-kind resubmit is all that's built.
    if payload.kind == "event" and payload.starts_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Event must start in the future")

    event = _get_own_event(db, event_id, current_user)
    event.kind = payload.kind
    event.title = payload.title
    event.description = payload.description
    event.starts_at = payload.starts_at
    event.frequency = payload.frequency
    event.is_online = payload.is_online
    event.location_lat = payload.location_lat
    event.location_lng = payload.location_lng
    event.location_label = payload.location_label
    event.join_policy = payload.join_policy
    event.activity_type = payload.activity_type
    # cover_image_url and group_id are deliberately untouched here —
    # cover_image_url is set only via POST /events/{id}/cover, and group_id
    # only at creation (or lazily by join_community for legacy rows), not
    # part of this full-replace payload.

    db.add(event)
    db.commit()
    db.refresh(event)
    _set_event_flags(db, event, current_user.id)
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    event = _get_own_event(db, event_id, current_user)
    # event_bookmarks rows cascade via its own FK ondelete — see
    # app/models/event.py. The linked ChatGroup doesn't (group_id is ON
    # DELETE SET NULL, the other direction), so it's deleted explicitly
    # here — this also cascades to that group's GroupMember/GroupMessage
    # rows via their own FKs (see app/models/group.py).
    if event.group_id is not None:
        group = db.get(ChatGroup, event.group_id)
        if group is not None:
            db.delete(group)
    db.delete(event)
    db.commit()


@router.post("/{event_id}/bookmark", status_code=status.HTTP_204_NO_CONTENT)
def bookmark_event(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if db.get(Event, event_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    already = db.execute(
        select(event_bookmarks).where(
            event_bookmarks.c.event_id == event_id, event_bookmarks.c.user_id == current_user.id
        )
    ).first()
    if already is None:
        db.execute(event_bookmarks.insert().values(event_id=event_id, user_id=current_user.id))
        db.commit()


@router.delete("/{event_id}/bookmark", status_code=status.HTTP_204_NO_CONTENT)
def unbookmark_event(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    db.execute(
        event_bookmarks.delete().where(
            event_bookmarks.c.event_id == event_id, event_bookmarks.c.user_id == current_user.id
        )
    )
    db.commit()


@router.post("/{event_id}/join", response_model=EventOut)
def join_community(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Event:
    event = _get_community(db, event_id)

    if event.group_id is None:
        # Legacy row from before communities got a linked group (created
        # before this migration) — create one now instead of leaving it
        # permanently unjoinable.
        event.group_id = _create_community_group(db, event.title, event.creator_id)
        db.add(event)
        db.commit()

    already = db.execute(
        select(GroupMember).where(GroupMember.group_id == event.group_id, GroupMember.user_id == current_user.id)
    ).first()
    if already is None:
        # join_policy ("anyone" vs "admin_approval") isn't enforced here —
        # every join is immediate. It already didn't gate anything before
        # this endpoint existed; a real pending-request/approve flow is
        # future work, not this pass.
        db.add(GroupMember(group_id=event.group_id, user_id=current_user.id, role="member"))
        db.commit()

    db.refresh(event)
    _set_event_flags(db, event, current_user.id)
    return event


@router.delete("/{event_id}/join", response_model=EventOut)
def leave_community(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Event:
    event = _get_community(db, event_id)
    if event.group_id is not None:
        # Community creators can leave their own community same as anyone
        # else for now — no special-case blocking it (mirrors how
        # remove_group_member in routes/groups.py only blocks *others*
        # removing an admin via that endpoint, not self-leave).
        db.execute(
            delete(GroupMember).where(GroupMember.group_id == event.group_id, GroupMember.user_id == current_user.id)
        )
        db.commit()

    _set_event_flags(db, event, current_user.id)
    return event
