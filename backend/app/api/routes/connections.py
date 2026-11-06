import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.notify import notify_user
from app.db.session import get_db
from app.models.block import UserBlock
from app.models.connection import Connection
from app.models.user import User
from app.schemas.user import UserSearchResult

router = APIRouter(prefix="/connections", tags=["connections"])

ConnectionStatus = Literal["none", "pending_out", "pending_in", "connected"]


class ConnectionStatusOut(BaseModel):
    status: ConnectionStatus


def _pair_filter(a: uuid.UUID, b: uuid.UUID):
    return or_(
        and_(Connection.requester_id == a, Connection.addressee_id == b),
        and_(Connection.requester_id == b, Connection.addressee_id == a),
    )


def _find(db: Session, a: uuid.UUID, b: uuid.UUID) -> Connection | None:
    return db.scalar(select(Connection).where(_pair_filter(a, b)))


def connection_status(db: Session, me: uuid.UUID, other: uuid.UUID) -> ConnectionStatus:
    row = _find(db, me, other)
    if row is None:
        return "none"
    if row.status == "accepted":
        return "connected"
    return "pending_out" if row.requester_id == me else "pending_in"


def count_connections(db: Session, user_id: uuid.UUID) -> int:
    # One row per pair, so a connection counts once for each side.
    return db.scalar(
        select(func.count())
        .select_from(Connection)
        .where(
            Connection.status == "accepted",
            or_(Connection.requester_id == user_id, Connection.addressee_id == user_id),
        )
    ) or 0


def remove_connection(db: Session, a: uuid.UUID, b: uuid.UUID) -> None:
    """Deletes any row between the pair (no commit -- the caller commits)."""
    db.execute(delete(Connection).where(_pair_filter(a, b)))


def _blocked_either_way(db: Session, a: uuid.UUID, b: uuid.UUID) -> bool:
    return db.scalar(
        select(UserBlock.id).where(
            or_(
                and_(UserBlock.blocker_id == a, UserBlock.blocked_id == b),
                and_(UserBlock.blocker_id == b, UserBlock.blocked_id == a),
            )
        )
    ) is not None


# Literal paths are declared before the {user_id} ones.
@router.get("", response_model=list[UserSearchResult])
def list_connections(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[User]:
    rows = db.scalars(
        select(Connection).where(
            Connection.status == "accepted",
            or_(Connection.requester_id == current_user.id, Connection.addressee_id == current_user.id),
        )
    ).all()
    ids = [r.addressee_id if r.requester_id == current_user.id else r.requester_id for r in rows]
    if not ids:
        return []
    return list(db.scalars(select(User).where(User.id.in_(ids)).order_by(User.username)).all())


@router.get("/requests", response_model=list[UserSearchResult])
def list_incoming_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[User]:
    ids = db.scalars(
        select(Connection.requester_id)
        .where(Connection.addressee_id == current_user.id, Connection.status == "pending")
        .order_by(Connection.created_at.desc())
    ).all()
    if not ids:
        return []
    users = {u.id: u for u in db.scalars(select(User).where(User.id.in_(ids))).all()}
    return [users[i] for i in ids if i in users]


@router.get("/sent", response_model=list[UserSearchResult])
def list_sent_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[User]:
    ids = db.scalars(
        select(Connection.addressee_id)
        .where(Connection.requester_id == current_user.id, Connection.status == "pending")
        .order_by(Connection.created_at.desc())
    ).all()
    if not ids:
        return []
    users = {u.id: u for u in db.scalars(select(User).where(User.id.in_(ids))).all()}
    return [users[i] for i in ids if i in users]


@router.post("/{user_id}", response_model=ConnectionStatusOut)
async def send_request(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConnectionStatusOut:
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't connect with yourself")
    if db.get(User, user_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if _blocked_either_way(db, current_user.id, user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can't connect with this user")

    existing = _find(db, current_user.id, user_id)
    if existing is not None:
        # They already asked me -> sending one back is the same as accepting.
        if existing.status == "pending" and existing.addressee_id == current_user.id:
            existing.status = "accepted"
            db.commit()
            await notify_user(
                db,
                user_id=user_id,
                type="connection_accepted",
                title="New connection",
                body=f"{current_user.username} accepted your connection request",
                data={"user_id": str(current_user.id)},
            )
            return ConnectionStatusOut(status="connected")
        return ConnectionStatusOut(status=connection_status(db, current_user.id, user_id))

    db.add(Connection(requester_id=current_user.id, addressee_id=user_id, status="pending"))
    db.commit()
    await notify_user(
        db,
        user_id=user_id,
        type="connection_request",
        title="Connection request",
        body=f"{current_user.username} wants to connect with you",
        data={"user_id": str(current_user.id)},
    )
    return ConnectionStatusOut(status="pending_out")


@router.post("/{user_id}/accept", response_model=ConnectionStatusOut)
async def accept_request(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConnectionStatusOut:
    row = db.scalar(
        select(Connection).where(
            Connection.requester_id == user_id,
            Connection.addressee_id == current_user.id,
        )
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No request from this user")
    if row.status == "pending":
        row.status = "accepted"
        db.commit()
        await notify_user(
            db,
            user_id=user_id,
            type="connection_accepted",
            title="New connection",
            body=f"{current_user.username} accepted your connection request",
            data={"user_id": str(current_user.id)},
        )
    return ConnectionStatusOut(status="connected")


# Cancel my request, decline theirs, or remove an existing connection -- all
# the same operation: the pair stops having a row.
@router.delete("/{user_id}", response_model=ConnectionStatusOut)
def remove(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConnectionStatusOut:
    remove_connection(db, current_user.id, user_id)
    db.commit()
    return ConnectionStatusOut(status="none")
