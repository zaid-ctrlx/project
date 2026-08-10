import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import exists, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.event import Event, event_bookmarks
from app.models.user import User
from app.schemas.event import JOIN_POLICY_OPTIONS, EventCreate, EventOut

router = APIRouter(prefix="/events", tags=["events"])


def _with_bookmark_flag(stmt, current_user_id: uuid.UUID):
    """Adds a correlated EXISTS(...) column so each row's bookmark state for
    the current user is computed in one query instead of N+1 lookups."""
    return stmt.add_columns(
        exists().where(
            event_bookmarks.c.event_id == Event.id,
            event_bookmarks.c.user_id == current_user_id,
        )
    )


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: EventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Event:
    if payload.starts_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Event must start in the future")

    event = Event(
        title=payload.title,
        description=payload.description,
        starts_at=payload.starts_at,
        location_lat=payload.location_lat,
        location_lng=payload.location_lng,
        location_label=payload.location_label,
        join_policy=payload.join_policy,
        activity_type=payload.activity_type,
        community_vibe=payload.community_vibe,
        skill_level=payload.skill_level,
        event_style=payload.event_style,
        creator_id=current_user.id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    event.creator = current_user
    event.is_bookmarked = False  # can't have bookmarks yet — just created
    return event


@router.get("", response_model=list[EventOut])
def list_events(
    q: str | None = Query(default=None, min_length=1, max_length=100),
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
    # First of several planned filters (see Event model comments) — distance,
    # attendee count, and category tags are meant to follow the same shape:
    # an optional Query param, applied here before the bookmark-flag/order/
    # paginate tail.
    if join_policy:
        stmt = stmt.where(Event.join_policy == join_policy)
    stmt = _with_bookmark_flag(stmt, current_user.id).order_by(Event.created_at.desc()).limit(limit).offset(offset)

    events: list[Event] = []
    for event, bookmarked in db.execute(stmt).all():
        event.is_bookmarked = bookmarked
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
        .order_by(Event.created_at.desc())
    )
    events = db.scalars(stmt).all()
    for event in events:
        event.is_bookmarked = True
    return events


@router.get("/mine", response_model=list[EventOut])
def list_my_events(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Event]:
    stmt = select(Event).options(selectinload(Event.creator)).where(Event.creator_id == current_user.id)
    stmt = _with_bookmark_flag(stmt, current_user.id).order_by(Event.created_at.desc())

    events: list[Event] = []
    for event, bookmarked in db.execute(stmt).all():
        event.is_bookmarked = bookmarked
        events.append(event)
    return events


def _get_own_event(db: Session, event_id: uuid.UUID, current_user: User) -> Event:
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if event.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the event's creator can do that")
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
    # event being edited, same shape as create_event's payload.
    if payload.starts_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Event must start in the future")

    event = _get_own_event(db, event_id, current_user)
    event.title = payload.title
    event.description = payload.description
    event.starts_at = payload.starts_at
    event.location_lat = payload.location_lat
    event.location_lng = payload.location_lng
    event.location_label = payload.location_label
    event.join_policy = payload.join_policy
    event.activity_type = payload.activity_type
    event.community_vibe = payload.community_vibe
    event.skill_level = payload.skill_level
    event.event_style = payload.event_style

    db.add(event)
    db.commit()
    db.refresh(event)
    event.is_bookmarked = db.execute(
        select(exists().where(event_bookmarks.c.event_id == event.id, event_bookmarks.c.user_id == current_user.id))
    ).scalar_one()
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    event = _get_own_event(db, event_id, current_user)
    # event_bookmarks rows cascade via its own FK ondelete — see app/models/event.py.
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
