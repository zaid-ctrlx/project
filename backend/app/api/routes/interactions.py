from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.event import Event
from app.models.user import User
from app.recsys.logging import log_interaction
from app.schemas.interaction import InteractionCreate

router = APIRouter(prefix="/interactions", tags=["interactions"])


@router.post("", status_code=status.HTTP_204_NO_CONTENT)
def record_view(
    payload: InteractionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Record that the user opened an event/community (implicit feedback)."""
    if db.get(Event, payload.event_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    log_interaction(db, current_user.id, payload.event_id, payload.kind)
