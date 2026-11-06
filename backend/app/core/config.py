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

    # Outbound email for verification / password-reset codes. Leave SMTP_HOST
    # empty in local dev and the codes are printed to the server console.
    # For Gmail: smtp.gmail.com, port 587, an App Password as SMTP_PASSWORD.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    # App
    PROJECT_NAME: str = "Niche Events API"
    API_V1_PREFIX: str = "/api/v1"

    # Local disk storage for user-uploaded files (avatars, etc.). Served
    # back out at the /media mount in main.py. Fine for dev; swap for
    # object storage (S3/R2) before any real deployment.
    MEDIA_ROOT: str = "media"



# Refuse to boot with the example/placeholder secret: it's public in the repo,
# so anyone could mint valid tokens. Generate one with:
#   python -c "import secrets; print(secrets.token_urlsafe(64))"
_settings = Settings()
if _settings.SECRET_KEY.startswith("change-this") or len(_settings.SECRET_KEY) < 32:
    raise RuntimeError("SECRET_KEY is a placeholder or too short - set a long random value in backend/.env")

settings = _settings
