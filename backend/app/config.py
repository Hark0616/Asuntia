from typing import List, Literal
from urllib.parse import urlsplit
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator, model_validator

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    
    # Base de Datos
    POSTGRES_USER: str = "asuntia"
    POSTGRES_PASSWORD: str = "asuntia_dev"
    POSTGRES_DB: str = "asuntia_db"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: str = "postgresql+asyncpg://asuntia:asuntia_dev@localhost:5432/asuntia_db"

    # Seguridad JWT
    JWT_SECRET: str = "super_secret_jwt_key_asuntia_change_in_prod_12345"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    COOKIE_DOMAIN: str | None = None
    FRONTEND_URL: str = "http://127.0.0.1:5173"
    AUTH_WINDOW_SECONDS: int = Field(default=900, ge=1)
    AUTH_MIN_RESPONSE_SECONDS: float = Field(default=0.2, ge=0, le=2)
    AUTH_LOGIN_LIMIT: int = Field(default=8, ge=1)
    AUTH_OTP_REQUEST_LIMIT: int = Field(default=3, ge=1)
    AUTH_VERIFY_LIMIT: int = Field(default=12, ge=1)
    AUTH_RECOVERY_REQUEST_LIMIT: int = Field(default=3, ge=1)
    AUTH_IP_LIMIT: int = Field(default=120, ge=1)
    OTP_TTL_MINUTES: int = Field(default=10, ge=1, le=30)
    OTP_MAX_ATTEMPTS: int = Field(default=5, ge=1, le=10)
    PASSWORD_RESET_TTL_MINUTES: int = Field(default=30, ge=1, le=60)

    # Google Drive OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_OAUTH_REDIRECT_URI: str = (
        "http://127.0.0.1:8000/api/v1/storage/oauth-callback"
    )
    STORAGE_TOKEN_ENCRYPTION_KEY: str = ""
    # Ruta estable incluso al arrancar uvicorn desde otro directorio.
    LOCAL_STORAGE_PATH: str = str(Path(__file__).resolve().parents[1] / "storage")
    MICROSOFT_CLIENT_ID: str = ""
    MICROSOFT_CLIENT_SECRET: str = ""
    MICROSOFT_OAUTH_REDIRECT_URI: str = "http://127.0.0.1:8000/api/v1/storage/onedrive/callback"
    REDIS_URL: str = "redis://127.0.0.1:6379/0"

    # CORS
    ALLOW_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Servicio de Correo / Mailpit
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_SECURITY: Literal["none", "starttls", "ssl"] = "none"
    SMTP_TIMEOUT_SECONDS: float = Field(default=5, gt=0, le=30)
    SMTP_MAX_ATTEMPTS: int = Field(default=2, ge=1, le=3)
    EMAILS_FROM_EMAIL: str = "no-reply@asuntia.com"
    EMAILS_FROM_NAME: str = "Asuntia Legal"

    @field_validator("FRONTEND_URL")
    @classmethod
    def validate_frontend_url(cls, value):
        parsed = urlsplit(value)
        if (parsed.scheme not in {"http", "https"} or not parsed.hostname
                or parsed.username or parsed.password or parsed.query or parsed.fragment
                or any(character.isspace() for character in value)):
            raise ValueError("FRONTEND_URL debe ser una URL HTTP(S) de confianza sin credenciales, query ni fragmento")
        return value.rstrip("/")

    @field_validator("MICROSOFT_OAUTH_REDIRECT_URI")
    @classmethod
    def validate_microsoft_redirect(cls, value):
        if not value:
            return value
        parsed = urlsplit(value)
        if (parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password
                or parsed.query or parsed.fragment or any(character.isspace() for character in value)):
            raise ValueError("MICROSOFT_OAUTH_REDIRECT_URI debe ser una URL HTTP(S) sin credenciales, query ni fragmento")
        return value

    @model_validator(mode="after")
    def validate_production_secrets(self):
        if bool(self.SMTP_USER) != bool(self.SMTP_PASSWORD):
            raise ValueError("SMTP_USER y SMTP_PASSWORD deben configurarse juntos")
        if (
            self.ENVIRONMENT == "production"
            and self.JWT_SECRET == "super_secret_jwt_key_asuntia_change_in_prod_12345"
        ):
            raise ValueError("JWT_SECRET debe configurarse explícitamente en producción")
        if self.ENVIRONMENT == "production" and not self.STORAGE_TOKEN_ENCRYPTION_KEY:
            raise ValueError(
                "STORAGE_TOKEN_ENCRYPTION_KEY debe configurarse explícitamente en producción"
            )
        if self.ENVIRONMENT == "production" and self.SMTP_SECURITY == "none":
            raise ValueError("SMTP_SECURITY debe usar starttls o ssl en producción")
        if self.ENVIRONMENT == "production" and not self.FRONTEND_URL.startswith("https://"):
            raise ValueError("FRONTEND_URL debe usar HTTPS en producción")
        if self.ENVIRONMENT == "production" and bool(self.MICROSOFT_CLIENT_ID) != bool(self.MICROSOFT_CLIENT_SECRET):
            raise ValueError("Configura juntos MICROSOFT_CLIENT_ID y MICROSOFT_CLIENT_SECRET")
        if (self.ENVIRONMENT == "production" and self.MICROSOFT_CLIENT_ID
                and not self.MICROSOFT_OAUTH_REDIRECT_URI.startswith("https://")):
            raise ValueError("MICROSOFT_OAUTH_REDIRECT_URI debe usar HTTPS en producción")
        return self

    @property
    def allow_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOW_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )

settings = Settings()
