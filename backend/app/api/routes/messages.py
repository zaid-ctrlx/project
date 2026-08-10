import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import and_, case, func, or_, select, update
from sqlalchemy.orm import Session, aliased

from app.api.deps import get_current_user
from app.core.security import decode_token
from app.core.ws_manager import manager
from app.db.session import SessionLocal, get_db
from app.models.group import ChatGroup, GroupMember, GroupMessage
from app.models.message import Message
from app.models.user import User
from app.schemas.message import ConversationOut, MessageCreate, MessageOut, MessageParticipantOut

router = APIRouter(prefix="/messages", tags=["messages"])


@router.post("", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def send_message(
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Message:
    if payload.recipient_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot message yourself")

    recipient = db.get(User, payload.recipient_id)
    if recipient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient not found")

    message = Message(sender_id=current_user.id, recipient_id=payload.recipient_id, body=payload.text)
    db.add(message)
    db.commit()
    db.refresh(message)

    # Best-effort live push. If the recipient isn't connected, they just see
    # it on next fetch — no offline push notification (separate future work).
    # This is the only route in this file that's async def, so it can await
    # the push; the sync DB calls above briefly block the event loop, an
    # acceptable tradeoff at FYP scale rather than threadpool gymnastics for
    # this one call site.
    await manager.send_to_user(
        payload.recipient_id,
        {"type": "message", "message": MessageOut.model_validate(message).model_dump(mode="json")},
    )
    return message


def _dm_conversations(db: Session, me: uuid.UUID) -> list[ConversationOut]:
    # "Latest message per counterpart" is a groupwise-max problem — solved
    # with ROW_NUMBER() over a partition keyed by whichever side of
    # (sender, recipient) isn't me, ordered newest-first, keeping rank 1.
    counterpart_id = case(
        (Message.sender_id == me, Message.recipient_id),
        else_=Message.sender_id,
    ).label("counterpart_id")

    ranked = (
        select(
            Message.id,
            Message.sender_id,
            Message.recipient_id,
            Message.body,
            Message.created_at,
            counterpart_id,
            func.row_number()
            .over(partition_by=counterpart_id, order_by=Message.created_at.desc())
            .label("rn"),
        )
        .where(or_(Message.sender_id == me, Message.recipient_id == me))
        .subquery()
    )

    latest_stmt = (
        select(ranked, User)
        .join(User, User.id == ranked.c.counterpart_id)
        .where(ranked.c.rn == 1)
        .order_by(ranked.c.created_at.desc())
    )

    # Second, lightweight aggregate query for unread counts, merged in
    # Python rather than folded into the window-function query above — two
    # small readable queries beat one contorted one at FYP scale.
    unread_counts = dict(
        db.execute(
            select(Message.sender_id, func.count())
            .where(Message.recipient_id == me, Message.read_at.is_(None))
            .group_by(Message.sender_id)
        ).all()
    )

    conversations: list[ConversationOut] = []
    for row in db.execute(latest_stmt).all():
        conversations.append(
            ConversationOut(
                type="dm",
                other_user=MessageParticipantOut.model_validate(row.User),
                last_message=row.body,
                last_message_at=row.created_at,
                last_sender_id=row.sender_id,
                unread_count=unread_counts.get(row.User.id, 0),
            )
        )
    return conversations


def _group_conversations(db: Session, me: uuid.UUID) -> list[ConversationOut]:
    memberships = db.execute(
        select(GroupMember, ChatGroup).join(ChatGroup, ChatGroup.id == GroupMember.group_id).where(GroupMember.user_id == me)
    ).all()
    if not memberships:
        return []
    group_ids = [row.GroupMember.group_id for row in memberships]

    # Latest message per group — same groupwise-max approach as the DM query
    # above, partitioned by group instead of by counterpart.
    ranked = (
        select(
            GroupMessage.group_id,
            GroupMessage.sender_id,
            GroupMessage.body,
            GroupMessage.created_at,
            func.row_number()
            .over(partition_by=GroupMessage.group_id, order_by=GroupMessage.created_at.desc())
            .label("rn"),
        )
        .where(GroupMessage.group_id.in_(group_ids))
        .subquery()
    )
    latest_by_group = {row.group_id: row for row in db.execute(select(ranked).where(ranked.c.rn == 1)).all()}

    member_counts = dict(
        db.execute(
            select(GroupMember.group_id, func.count()).where(GroupMember.group_id.in_(group_ids)).group_by(GroupMember.group_id)
        ).all()
    )

    # Unread = messages from someone else, newer than *my* last_read_at on
    # that group (NULL last_read_at = never opened = everything's unread) —
    # expressed as a self-join back to my own membership row so it can stay
    # one grouped query instead of one query per group.
    my_membership = aliased(GroupMember)
    unread_counts = dict(
        db.execute(
            select(GroupMessage.group_id, func.count())
            .join(my_membership, and_(my_membership.group_id == GroupMessage.group_id, my_membership.user_id == me))
            .where(
                GroupMessage.group_id.in_(group_ids),
                GroupMessage.sender_id != me,
                or_(my_membership.last_read_at.is_(None), GroupMessage.created_at > my_membership.last_read_at),
            )
            .group_by(GroupMessage.group_id)
        ).all()
    )

    conversations: list[ConversationOut] = []
    for row in memberships:
        group = row.ChatGroup
        latest = latest_by_group.get(group.id)
        conversations.append(
            ConversationOut(
                type="group",
                group_id=group.id,
                group_name=group.name,
                member_count=member_counts.get(group.id, 0),
                last_message=latest.body if latest else "",
                # No messages yet: sort by group creation so a brand-new,
                # still-empty group still shows up (at the top, typically).
                last_message_at=latest.created_at if latest else group.created_at,
                last_sender_id=latest.sender_id if latest else None,
                unread_count=unread_counts.get(group.id, 0),
            )
        )
    return conversations


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ConversationOut]:
    # One merged, newest-first list of DMs and groups — the mobile client
    # renders both in a single scrolling list rather than stitching two
    # endpoints together itself.
    conversations = _dm_conversations(db, current_user.id) + _group_conversations(db, current_user.id)
    conversations.sort(key=lambda c: c.last_message_at, reverse=True)
    return conversations


@router.get("/with/{user_id}", response_model=list[MessageOut])
def get_thread(
    user_id: uuid.UUID,
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Message]:
    if db.get(User, user_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    stmt = (
        select(Message)
        .where(
            or_(
                and_(Message.sender_id == current_user.id, Message.recipient_id == user_id),
                and_(Message.sender_id == user_id, Message.recipient_id == current_user.id),
            )
        )
        # Newest-first, paginated like GET /events. The mobile client keeps
        # this order and renders via an inverted FlatList for the natural
        # oldest-at-top chat layout, rather than reversing client-side.
        .order_by(Message.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return db.scalars(stmt).all()


@router.post("/with/{user_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_thread_read(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    # No existence check on user_id, mirroring unbookmark_event's style —
    # marking messages from a nonexistent/typo'd user simply updates 0 rows.
    db.execute(
        update(Message)
        .where(
            Message.sender_id == user_id,
            Message.recipient_id == current_user.id,
            Message.read_at.is_(None),
        )
        .values(read_at=func.now())
    )
    db.commit()


@router.websocket("/ws")
async def messages_ws(websocket: WebSocket, token: str = Query(...)) -> None:
    # Can't use the normal OAuth2PasswordBearer/get_current_user dependency
    # here — React Native's WebSocket client can't attach an Authorization
    # header to the handshake. Accept first, then validate the JWT passed as
    # a query param, closing with a policy-violation code if it's bad — this
    # is friendlier to RN's WebSocket than rejecting at the HTTP handshake
    # level, where onerror/onclose surface little detail.
    await websocket.accept()

    payload = decode_token(token)
    user_id: uuid.UUID | None = None
    if payload is not None and payload.get("type") == "access":
        try:
            user_id = uuid.UUID(payload["sub"])
        except (KeyError, TypeError, ValueError):
            user_id = None

    if user_id is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    db = SessionLocal()
    try:
        user = db.get(User, user_id)
    finally:
        db.close()
    if user is None or not user.is_active:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    manager.register(user_id, websocket)
    try:
        while True:
            # Push-only from the server today; block on receive purely to
            # detect disconnects (the client sends nothing meaningful here).
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.unregister(user_id, websocket)
