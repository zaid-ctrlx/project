from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, decode_token, password_fingerprint, token_is_current


def test_token_roundtrip_and_password_fingerprint():
    payload = decode_token(create_access_token("user-1", "hash-a"))
    assert payload["sub"] == "user-1" and payload["type"] == "access"
    assert token_is_current(payload, "hash-a")
    assert not token_is_current(payload, "hash-b")  # password changed -> token dead
    assert decode_token(create_refresh_token("user-1", "hash-a"))["type"] == "refresh"


def test_bad_tokens_are_rejected():
    good = create_access_token("user-1", "hash-a")
    assert decode_token(good[:-3] + "abc") is None  # tampered
    assert decode_token("not.a.token") is None
    expired = jwt.encode(
        {"sub": "u", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)}, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    assert decode_token(expired) is None
    forged = jwt.encode({"sub": "u", "pf": password_fingerprint("x")}, "wrong-key-wrong-key-wrong-key-0000", algorithm="HS256")
    assert decode_token(forged) is None
