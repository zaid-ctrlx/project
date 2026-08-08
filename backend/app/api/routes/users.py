from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import Tag, User
from app.schemas.user import ProfileUpdate, UserOut, UserSearchResult

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user


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
    pattern = f"%{q}%"
    return db.scalars(
        select(User)
        .where(
            User.id != current_user.id,
            or_(User.username.ilike(pattern), User.full_name.ilike(pattern)),
        )
        .order_by(func.lower(User.username))
        .limit(20)
    ).all()


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
    current_user.location_lat = payload.location_lat
    current_user.location_lng = payload.location_lng
    current_user.location_label = payload.location_label
    current_user.onboarding_completed = True

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user
