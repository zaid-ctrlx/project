import uuid

from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.email import send_email
from app.core.otp import Purpose, consume_otp, issue_otp
from app.core.ratelimit import FailureLimiter
from app.core.security import (
    DUMMY_PASSWORD_HASH,
    token_is_current,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.core.username import generate_unique_username
from app.db.session import get_db
from app.models.user import User
from app.schemas.token import (
    EmailCodeRequest,
    EmailRequest,
    MessageOut,
    RefreshRequest,
    ResetPasswordRequest,
    Token,
)
from app.schemas.user import UserCreate, UserLogin

router = APIRouter(prefix="/auth", tags=["auth"])

# Failed logins only: 5 per account and 20 per client IP per 15 minutes. A
# success clears the account's counter.
_login_by_account = FailureLimiter(max_failures=5, window_seconds=15 * 60)
_login_by_ip = FailureLimiter(max_failures=20, window_seconds=15 * 60)
# Anything that sends an email (register / resend / forgot): 10 per client IP
# per 15 minutes, so the endpoints can't be used to flood someone's inbox or
# burn through the SMTP quota.
_mail_by_ip = FailureLimiter(max_failures=10, window_seconds=15 * 60)


def _throttle_mail(request: Request) -> None:
    key = request.client.host if request.client else "unknown"
    _mail_by_ip.check(key)
    _mail_by_ip.fail(key)


def _find_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(func.lower(User.email) == email.lower()).first()


def _send_code(db: Session, user: User, purpose: Purpose, background: BackgroundTasks) -> None:
    background.add_task(send_email, *issue_otp(db, user, purpose))


def _tokens(user: User) -> Token:
    return Token(
        access_token=create_access_token(str(user.id), user.hashed_password),
        refresh_token=create_refresh_token(str(user.id), user.hashed_password),
    )


@router.post("/register", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def register(
    payload: UserCreate, request: Request, background: BackgroundTasks, db: Session = Depends(get_db)
) -> MessageOut:
    """Creates the account unverified and emails a 6-digit code. No tokens are
    issued until the address is proven via /verify-email."""
    _throttle_mail(request)
    # Reject addresses whose domain can't receive mail at all (typos, made-up
    # domains, example.com). A real domain with a fake mailbox still gets
    # through here - only the emailed code can prove that one.
    try:
        validate_email(payload.email, check_deliverability=True)
    except EmailNotValidError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That email address can't receive mail. Check it for typos and use a real email.",
        )

    existing = _find_by_email(db, payload.email)
    if existing is not None and existing.is_verified:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    if existing is not None:
        # Unverified leftover (abandoned or squatted signup): whoever
        # registers again takes it over; the previous password stops working.
        existing.hashed_password = hash_password(payload.password)
        existing.full_name = payload.full_name
        user = existing
    else:
        user = User(
            email=payload.email,
            hashed_password=hash_password(payload.password),
            full_name=payload.full_name,
            username=generate_unique_username(db, payload.email),
        )
        db.add(user)
    db.commit()

    _send_code(db, user, "verify", background)
    return MessageOut(message="Verification code sent")


@router.post("/resend-verification", response_model=MessageOut)
def resend_verification(
    payload: EmailRequest, request: Request, background: BackgroundTasks, db: Session = Depends(get_db)
) -> MessageOut:
    _throttle_mail(request)
    user = _find_by_email(db, payload.email)
    if user is not None and not user.is_verified and user.is_active:
        try:
            _send_code(db, user, "verify", background)
        except HTTPException:
            pass  # resend cooldown: answering 429 here would reveal the account exists
    # Same answer whether or not the account exists, so this can't be used
    # to probe which emails are registered.
    return MessageOut(message="If that account needs verification, a code has been sent")


@router.post("/verify-email", response_model=Token)
def verify_email(payload: EmailCodeRequest, db: Session = Depends(get_db)) -> Token:
    user = _find_by_email(db, payload.email)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code")
    consume_otp(db, user, "verify", payload.code)
    user.is_verified = True
    db.commit()
    return _tokens(user)


@router.post("/forgot-password", response_model=MessageOut)
def forgot_password(
    payload: EmailRequest, request: Request, background: BackgroundTasks, db: Session = Depends(get_db)
) -> MessageOut:
    _throttle_mail(request)
    user = _find_by_email(db, payload.email)
    if user is not None and user.is_active:
        try:
            _send_code(db, user, "reset", background)
        except HTTPException:
            pass  # resend cooldown: answering 429 here would reveal the account exists
    return MessageOut(message="If that email has an account, a reset code has been sent")


@router.post("/reset-password", response_model=MessageOut)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> MessageOut:
    user = _find_by_email(db, payload.email)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code")
    consume_otp(db, user, "reset", payload.code)
    user.hashed_password = hash_password(payload.new_password)
    # Receiving the reset code proves ownership of the inbox as well.
    user.is_verified = True
    db.commit()
    return MessageOut(message="Password updated")


@router.post("/login", response_model=Token)
def login(
    payload: UserLogin, request: Request, background: BackgroundTasks, db: Session = Depends(get_db)
) -> Token:
    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email/username or password",
    )

    account_key = payload.identifier.strip().lower()
    ip_key = request.client.host if request.client else "unknown"
    _login_by_account.check(account_key)
    _login_by_ip.check(ip_key)

    # Case-insensitive match against either column — email is conventionally
    # case-insensitive, and username search elsewhere (routes/users.py) is
    # too. A bare identifier can only ever match one of the two in practice
    # (usernames can't contain "@"), so this can't cross-match someone's
    # username against another person's email.
    identifier = func.lower(payload.identifier)
    user = db.query(User).filter(
        or_(func.lower(User.email) == identifier, func.lower(User.username) == identifier)
    ).first()
    password_ok = verify_password(payload.password, user.hashed_password if user else DUMMY_PASSWORD_HASH)
    if user is None or not password_ok:
        _login_by_account.fail(account_key)
        _login_by_ip.fail(ip_key)
        raise invalid_credentials
    _login_by_account.reset(account_key)
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
    if not user.is_verified:
        # Correct password but unproven email (e.g. signed up, never entered
        # the code): send a fresh code and let the app jump to the code screen.
        try:
            _send_code(db, user, "verify", background)
        except HTTPException:
            pass  # still inside the resend cooldown; the earlier code stands
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "email_not_verified",
                "message": "Please verify your email to continue",
                "email": user.email,
            },
        )

    return _tokens(user)


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
    if user is None or not user.is_active or not user.is_verified or not token_is_current(decoded, user.hashed_password):
        raise invalid_token

    return _tokens(user)
