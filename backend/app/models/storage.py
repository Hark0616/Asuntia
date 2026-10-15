"""Conexiones duraderas y operaciones remotas recuperables por firma."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class StorageConnection(BaseModel):
    __tablename__ = "storage_connections"
    __table_args__ = (UniqueConstraint("firma_id", "provider", "drive_id", name="uq_storage_connection_drive"),)

    provider: Mapped[str] = mapped_column(String(30), nullable=False)
    drive_id: Mapped[str] = mapped_column(String(255), nullable=False)
    account_name: Mapped[str | None] = mapped_column(String(255))
    root_folder_id: Mapped[str | None] = mapped_column(String(255))
    root_folder_name: Mapped[str | None] = mapped_column(String(255))
    access_token_cipher: Mapped[str | None] = mapped_column(Text)
    refresh_token_cipher: Mapped[str | None] = mapped_column(Text)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    generation: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")


class StorageOperation(BaseModel):
    __tablename__ = "storage_operations"

    kind: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="queued", server_default="queued", index=True)
    asunto_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("asuntos.id"), index=True)
    connection_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("storage_connections.id"), index=True)
    documento_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("documentos_asunto.id"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    user_revision: Mapped[str] = mapped_column(String(60), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    secrets_cipher: Mapped[str | None] = mapped_column(Text)
    result: Mapped[dict | None] = mapped_column(JSONB)
    error_code: Mapped[str | None] = mapped_column(String(40))
    error_message: Mapped[str | None] = mapped_column(String(255))
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
