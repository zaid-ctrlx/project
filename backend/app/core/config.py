from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central app configuration, loaded from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Database
    DATABASE_URL: str

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # App
    PROJECT_NAME: str = "Niche Events API"
    API_V1_PREFIX: str = "/api/v1"

    # Local disk storage for user-uploaded files (avatars, etc.). Served
    # back out at the /media mount in main.py. Fine for dev; swap for
    # object storage (S3/R2) before any real deployment.
    MEDIA_ROOT: str = "media"


settings = Settings()
