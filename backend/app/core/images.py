from fastapi import HTTPException, status

# Leading bytes of each accepted upload type. The Content-Type header is
# client-supplied, so the file itself has to agree with it.
_SIGNATURES = {
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/webp": (b"RIFF",),
}


def verify_image(contents: bytes, content_type: str | None) -> None:
    """Raise 400 unless the bytes really look like the declared image type."""
    prefixes = _SIGNATURES.get(content_type or "")
    ok = prefixes is not None and any(contents.startswith(p) for p in prefixes)
    if ok and content_type == "image/webp":
        ok = contents[8:12] == b"WEBP"
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That file isn't a valid image")
