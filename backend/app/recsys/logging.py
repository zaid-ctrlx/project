import uuid

from sqlalchemy.orm import Session

from app.models.interaction import Interaction


def log_interaction(db: Session, user_id: uuid.UUID, event_id: uuid.UUID, kind: str) -> None:
    """Append one interaction row. Never raises into the caller: a logging
    failure must not break bookmarking/RSVPing. Commits its own row."""
    try:
        db.add(Interaction(user_id=user_id, event_id=event_id, kind=kind))
        db.commit()
    except Exception:  # pragma: no cover - defensive
        db.rollback()
