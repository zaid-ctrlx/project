import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.notify import notify_user
from app.core.ws_manager import manager
from app.db.session import get_db
from app.models.group import ChatGroup, GroupMember, GroupMessage
from app.models.user import User
from app.schemas.group import (
    AddGroupMemberPayload,
    ChatGroupCreate,
    ChatGroupOut,
    GroupMessageCreate,
    GroupMessageOut,
    MuteGroupPayload,
)

router = APIRouter(prefix="/groups", tags=["groups"])

# Same allowlist/size cap as the user-avatar upload (see routes/users.py).
AVATAR_MAX_BYTES = 5 * 1024 * 1024  # 5MB
AVATAR_EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}

# Same notification-preview cap as messages.py's send_message.
NOTIFICATION_PREVIEW_LEN = 120


def _preview(text: str) -> str:
    text = text.strip()
    return text if len(text) <= NOTIFICATION_PREVIEW_LEN else text[:NOTIFICATION_PREVIEW_LEN].rstrip() + "…"


def _load_group(db: Session, group_id: uuid.UUID) -> ChatGroup:
    group = db.execute(
        select(ChatGroup)
        .options(selectinload(ChatGroup.members).selectinload(GroupMember.user))
        .where(ChatGroup.id == group_id)
    ).scalar_one_or_none()
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    return group


def _get_membership(db: Session, group_id: uuid.UUID, user_id: uuid.UUID) -> GroupMember:
    membership = db.execute(
        select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
    ).scalar_one_or_none()
    if membership is None:
        # Covers both "no such group" and "you're not in it" with the same
        # 404 — membership isn't leaked to non-members either way.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    return membership


@router.post("", response_model=ChatGroupOut, status_code=status.HTTP_201_CREATED)
def create_group(
    payload: ChatGroupCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatGroup:
    # Creator is always added as admin below, regardless of whether they
    # also listed themself in member_ids.
    member_ids = set(payload.member_ids) - {current_user.id}
    if member_ids:
        found_ids = set(db.scalars(select(User.id).where(User.id.in_(member_ids))).all())
        missing = member_ids - found_ids
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown user id(s): {', '.join(str(m) for m in missing)}",
            )

    group = ChatGroup(id=uuid.uuid4(), name=payload.name, creator_id=current_user.id)
    db.add(group)
    db.add(GroupMember(group_id=group.id, user_id=current_user.id, role="admin"))
    for member_id in member_ids:
        db.add(GroupMember(group_id=group.id, user_id=member_id, role="member"))
    db.commit()

    return _load_group(db, group.id)


@router.get("/{group_id}", response_model=ChatGroupOut)
def get_group(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatGroup:
    _get_membership(db, group_id, current_user.id)
    return _load_group(db, group_id)


@router.post("/{group_id}/members", response_model=ChatGroupOut)
async def add_group_member(
    group_id: uuid.UUID,
    payload: AddGroupMemberPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatGroup:
    membership = _get_membership(db, group_id, current_user.id)
    if membership.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only a group admin can add members")

    new_member = db.get(User, payload.user_id)
    if new_member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Idempotent, mirroring bookmark_event's style in routes/events.py —
    # adding someone already in the group is a no-op, not an error (and not
    # worth a duplicate "added to group" notification either).
    already = db.execute(
        select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == payload.user_id)
    ).scalar_one_or_none()
    if already is None:
        db.add(GroupMember(group_id=group_id, user_id=payload.user_id, role="member"))
        db.commit()

        group = db.get(ChatGroup, group_id)
        await notify_user(
            db,
            user_id=payload.user_id,
            type="added_to_group",
            title="Added to a group",
            body=f"{current_user.username} added you to {group.name}",
            data={"group_id": str(group_id)},
        )

    return _load_group(db, group_id)


@router.delete("/{group_id}/members/{user_id}", response_model=ChatGroupOut)
def remove_group_member(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatGroup:
    membership = _get_membership(db, group_id, current_user.id)
    if membership.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only a group admin can remove members")
    if user_id == current_user.id:
        # Deliberately distinct from "leave group" (not built yet) — an
        # admin removing themselves through this endpoint would silently
        # drop their own access, which isn't what this button is for. The
        # mobile client already never shows "Remove" on your own contact
        # info; this is the server-side backstop.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Use leave group instead of removing yourself"
        )

    db.execute(delete(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user_id))
    db.commit()
    return _load_group(db, group_id)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    membership = _get_membership(db, group_id, current_user.id)
    if membership.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only a group admin can delete the group")

    group = db.get(ChatGroup, group_id)
    # _get_membership above already 404s if the group doesn't exist, so
    # `group` is guaranteed non-None here.
    db.delete(group)  # cascades to GroupMember/GroupMessage rows via their
    # own FKs (see app/models/group.py). If this group backs a community
    # (Event.group_id), that FK is ON DELETE SET NULL rather than CASCADE —
    # the community post survives, just loses its group link, and a later
    # join lazily recreates a fresh one (see join_community in
    # routes/events.py). Deleting *the community* itself is a separate
    # action (DELETE /events/{id}), which deletes the group the other way
    # around.
    db.commit()


@router.post("/{group_id}/avatar", response_model=ChatGroupOut)
async def upload_group_avatar(
    group_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatGroup:
    # Same validation/storage shape as POST /users/me/avatar, admin-gated
    # like add_group_member above — separate endpoint (not folded into
    # ChatGroupCreate) because the group needs to exist first to have an id
    # to save the file under; the mobile client calls this right after
    # POST /groups succeeds, from the same "Create group" button press.
    membership = _get_membership(db, group_id, current_user.id)
    if membership.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only a group admin can set the group photo")

    if file.content_type not in AVATAR_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPEG, PNG, or WEBP images are allowed",
        )

    contents = await file.read()
    if len(contents) > AVATAR_MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image must be under 5MB")

    avatars_dir = Path(settings.MEDIA_ROOT) / "group_avatars"
    avatars_dir.mkdir(parents=True, exist_ok=True)

    for old in avatars_dir.glob(f"{group_id}_*"):
        old.unlink(missing_ok=True)

    ext = AVATAR_EXTENSIONS[file.content_type]
    filename = f"{group_id}_{uuid.uuid4().hex[:8]}.{ext}"
    (avatars_dir / filename).write_bytes(contents)

    group = db.get(ChatGroup, group_id)
    group.avatar_url = f"/media/group_avatars/{filename}"
    db.add(group)
    db.commit()

    return _load_group(db, group_id)


@router.get("/{group_id}/messages", response_model=list[GroupMessageOut])
def get_group_thread(
    group_id: uuid.UUID,
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[GroupMessage]:
    membership = _get_membership(db, group_id, current_user.id)
    stmt = select(GroupMessage).where(GroupMessage.group_id == group_id)
    if membership.cleared_at is not None:
        # Permanently hidden from me past this point, same as
        # GET /messages/with/{user_id} — pagination can't scroll back past
        # it either. See DmClear's docstring (app/models/message.py).
        stmt = stmt.where(GroupMessage.created_at > membership.cleared_at)
    stmt = (
        stmt
        # Newest-first, paginated, inverted-FlatList on the client — same
        # convention as GET /messages/with/{user_id}.
        .order_by(GroupMessage.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return db.scalars(stmt).all()


@router.post("/{group_id}/messages", response_model=GroupMessageOut, status_code=status.HTTP_201_CREATED)
async def send_group_message(
    group_id: uuid.UUID,
    payload: GroupMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GroupMessage:
    _get_membership(db, group_id, current_user.id)

    message = GroupMessage(group_id=group_id, sender_id=current_user.id, body=payload.text)
    db.add(message)
    db.commit()
    db.refresh(message)
    # Non-mapped attribute — see GroupMessageOut.sender_username's
    # docstring. Set once here so it flows into both the WS payload below
    # and this endpoint's own response (response_model=GroupMessageOut
    # serializes `message` the same way at the end of this function).
    message.sender_username = current_user.username

    # Best-effort live push to every other member currently connected — same
    # fire-and-forget approach as send_message in routes/messages.py (no
    # offline push notification). The sender doesn't get pushed to itself,
    # matching that route too: it already has the row via this response.
    # Unlike the notification loop below, this fires for muted members too —
    # mute only gates the notification system, not live chat delivery to a
    # thread someone already has open (see GroupMember.muted's docstring).
    other_members = db.execute(
        select(GroupMember.user_id, GroupMember.muted).where(
            GroupMember.group_id == group_id, GroupMember.user_id != current_user.id
        )
    ).all()
    ws_payload = {"type": "group_message", "message": GroupMessageOut.model_validate(message).model_dump(mode="json")}
    for member_id, _muted in other_members:
        await manager.send_to_user(member_id, ws_payload)

    group = db.get(ChatGroup, group_id)
    for member_id, muted in other_members:
        if muted:
            continue
        await notify_user(
            db,
            user_id=member_id,
            type="group_message",
            title=f"{current_user.username} in {group.name}",
            body=_preview(payload.text),
            data={"group_id": str(group_id), "sender_id": str(current_user.id)},
        )

    return message


@router.patch("/{group_id}/mute", response_model=ChatGroupOut)
def set_group_muted(
    group_id: uuid.UUID,
    payload: MuteGroupPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatGroup:
    # Per-member, not group-wide — covers both plain group chats
    # (GroupInfoScreen) and communities (CommunityProfileScreen, same
    # underlying ChatGroup via Event.group_id). Muting only affects the
    # notification system (see notify_user's callers); the mobile client
    # reads the result back off ChatGroupOut.members[me].muted rather than
    # this needing its own response shape.
    _get_membership(db, group_id, current_user.id)
    db.execute(
        update(GroupMember)
        .where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id)
        .values(muted=payload.muted)
    )
    db.commit()
    return _load_group(db, group_id)


@router.post("/{group_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_group_read(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    _get_membership(db, group_id, current_user.id)
    db.execute(
        update(GroupMember)
        .where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id)
        .values(last_read_at=func.now())
    )
    db.commit()


@router.post("/{group_id}/clear", status_code=status.HTTP_204_NO_CONTENT)
def clear_group_chat(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    # One-sided — see DmClear's docstring (app/models/message.py) for why
    # this is a column here (a per-membership row already exists) rather
    # than a whole separate table like the DM side needs.
    _get_membership(db, group_id, current_user.id)
    db.execute(
        update(GroupMember)
        .where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id)
        .values(cleared_at=func.now())
    )
    db.commit()
