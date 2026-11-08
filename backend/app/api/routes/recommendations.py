from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.api.routes.events import _load_event_rows
from app.db.session import get_db
from app.models.event import Event
from app.models.user import User
from app.recsys import service
from app.schemas.event import EventOut

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("", response_model=list[EventOut])
def get_recommendations(
    limit: int = Query(default=20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Event]:
    """Hybrid-ranked events/communities for the current user, best first, each
    with a short human-readable `recommendation_reason`. New users get
    content-based results; collaborative filtering blends in as they interact
    (see app/recsys/hybrid.py)."""
    ranked = service.recommend(db, current_user, limit)
    if not ranked:
        return []
    stmt = select(Event).options(selectinload(Event.creator)).where(Event.id.in_([r[0] for r in ranked]))
    by_id = {e.id: e for e in _load_event_rows(db, stmt, current_user)}
    out: list[Event] = []
    for event_id, reason, dist in ranked:
        event = by_id.get(event_id)
        if event is not None:
            event.recommendation_reason = reason
            event.distance_km = dist
            out.append(event)
    return out
