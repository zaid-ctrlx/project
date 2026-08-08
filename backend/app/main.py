from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, tags, users
from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

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


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
