import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.core.username import generate_unique_username
from app.db.session import get_db
from app.models.user import User
from app.schemas.token import RefreshRequest, Token
from app.schemas.user import UserCreate, UserLogin, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        username=generate_unique_username(db, payload.email),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> Token:
    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email/username or password",
    )

    # Case-insensitive match against either column — email is conventionally
    # case-insensitive, and username search elsewhere (routes/users.py) is
    # too. A bare identifier can only ever match one of the two in practice
    # (usernames can't contain "@"), so this can't cross-match someone's
    # username against another person's email.
    identifier = func.lower(payload.identifier)
    user = db.query(User).filter(
        or_(func.lower(User.email) == identifier, func.lower(User.username) == identifier)
    ).first()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise invalid_credentials
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")

    return Token(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/refresh", response_model=Token)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> Token:
    invalid_token = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token",
    )

    decoded = decode_token(payload.refresh_token)
    if decoded is None or decoded.get("type") != "refresh":
        raise invalid_token

    user_id = decoded.get("sub")
    try:
        user = db.get(User, uuid.UUID(user_id)) if user_id else None
    except ValueError:
        raise invalid_token
    if user is None or not user.is_active:
        raise invalid_token

    return Token(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )
