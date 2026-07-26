from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator

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

    # CORS
    ALLOW_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Servicio de Correo / Mailpit
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM_EMAIL: str = "no-reply@asuntia.com"
    EMAILS_FROM_NAME: str = "Asuntia Legal"

    @property
    def allow_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOW_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
