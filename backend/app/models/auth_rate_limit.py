from datetime import datetime

from sqlalchemy import DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class AuthRateLimit(BaseModel):
    """Presupuesto técnico compartido entre procesos; la clave no contiene PII."""

    __tablename__ = "auth_rate_limits"
    __table_args__ = (UniqueConstraint("firma_id", "key_hash", name="uq_auth_rate_limit_key"),)

    key_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
