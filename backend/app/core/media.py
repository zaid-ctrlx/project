"""Hardened static file serving for uploaded images (/media).

Uploads are already validated and stored under random, unguessable names (see
app/core/images.py and the upload routes). This adds defence in depth on the way
OUT, so a file in the media folder can never be used to attack someone's browser
or app:

- only real image types are served; anything else (an .html, .svg, .js, a file
  someone dropped in by hand) answers 404;
- `nosniff` stops a browser guessing a different type than the one we send;
- a locked-down Content-Security-Policy means even if a script-bearing file
  were served it could not run;
- directory listings are off (Starlette's default) and `..` paths are refused.

Files are still fetchable by anyone who has the exact URL, because the app's
<Image> components load them without a login header. The names are random, so
the URLs cannot be guessed, but they are not private if someone shares them.
"""
from pathlib import PurePosixPath

from starlette.exceptions import HTTPException
from starlette.staticfiles import StaticFiles

ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


class SafeImageFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        parts = PurePosixPath(path).parts
        if ".." in parts or PurePosixPath(path).suffix.lower() not in ALLOWED_SUFFIXES:
            raise HTTPException(status_code=404)
        response = await super().get_response(path, scope)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; sandbox"
        response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
        return response
