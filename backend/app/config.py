from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator

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

    # Google Drive OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_OAUTH_REDIRECT_URI: str = (
        "http://127.0.0.1:8000/api/v1/storage/oauth-callback"
    )
    STORAGE_TOKEN_ENCRYPTION_KEY: str = ""

    # CORS
    ALLOW_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Servicio de Correo / Mailpit
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM_EMAIL: str = "no-reply@asuntia.com"
    EMAILS_FROM_NAME: str = "Asuntia Legal"

    @model_validator(mode="after")
    def validate_production_secrets(self):
        if (
            self.ENVIRONMENT == "production"
            and self.JWT_SECRET == "super_secret_jwt_key_asuntia_change_in_prod_12345"
        ):
            raise ValueError("JWT_SECRET debe configurarse explícitamente en producción")
        if self.ENVIRONMENT == "production" and not self.STORAGE_TOKEN_ENCRYPTION_KEY:
            raise ValueError(
                "STORAGE_TOKEN_ENCRYPTION_KEY debe configurarse explícitamente en producción"
            )
        return self

    @property
    def allow_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOW_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
