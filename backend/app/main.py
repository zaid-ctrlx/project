import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import auth, events, geocode, groups, messages, notifications, tags, users
from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

# Serves uploaded files (avatars, etc.) back out as plain static URLs.
os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
app.mount("/media", StaticFiles(directory=settings.MEDIA_ROOT), name="media")

# Wide open for now: mobile dev client (Expo Go) hits this from a LAN IP that
# changes per network, so we can't pin an origin list yet. Tighten before any
# real deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(users.router, prefix=settings.API_V1_PREFIX)
app.include_router(tags.router, prefix=settings.API_V1_PREFIX)
app.include_router(geocode.router, prefix=settings.API_V1_PREFIX)
app.include_router(events.router, prefix=settings.API_V1_PREFIX)
app.include_router(messages.router, prefix=settings.API_V1_PREFIX)
app.include_router(groups.router, prefix=settings.API_V1_PREFIX)
app.include_router(notifications.router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
