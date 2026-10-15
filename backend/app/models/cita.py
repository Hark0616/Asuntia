"""Citas del expediente y su historial, independientes de la guía."""
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Cita(BaseModel):
    __tablename__ = "citas"
    __table_args__ = (
        UniqueConstraint("firma_id", "operacion_id", name="uq_cita_operacion"),
        UniqueConstraint("origen_paso_id", name="uq_cita_origen_paso"),
        CheckConstraint("tipo IN ('reunion', 'audiencia')", name="ck_cita_tipo"),
        CheckConstraint("estado IN ('programada', 'cancelada')", name="ck_cita_estado"),
        CheckConstraint("fin IS NULL OR (fin > inicio AND fin <= inicio + interval '24 hours')", name="ck_cita_intervalo"),
        Index("ix_cita_agenda", "firma_id", "estado", "inicio"),
    )
    asunto_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("asuntos.id"), index=True)
    operacion_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    solicitud_hash: Mapped[str] = mapped_column(String(64))
    origen_paso_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("asunto_pasos.id"))
    tipo: Mapped[str] = mapped_column(String(16))
    titulo: Mapped[str] = mapped_column(String(180))
    inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    fin: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    zona_horaria: Mapped[str] = mapped_column(String(80))
    responsable_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    # Identidades de oficina validadas bajo bloqueo de firma. No conceden acceso al asunto.
    participantes_ids: Mapped[list[str]] = mapped_column(JSONB, default=list)
    lugar: Mapped[str | None] = mapped_column(String(300))
    enlace: Mapped[str | None] = mapped_column(String(1000))
    resumen: Mapped[str | None] = mapped_column(Text)
    estado: Mapped[str] = mapped_column(String(16), default="programada")
    motivo_cancelacion: Mapped[str | None] = mapped_column(String(500))
    asunto = relationship("Asunto", lazy="raise")
    responsable = relationship("User", foreign_keys=[responsable_id], lazy="raise")


class CitaCambio(BaseModel):
    """Solo inserciones desde los comandos de cita; sin edición ni borrado público."""
    __tablename__ = "cita_cambios"
    cita_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("citas.id"), index=True)
    accion: Mapped[str] = mapped_column(String(24))
    datos: Mapped[dict] = mapped_column(JSONB)

