import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.asunto import Asunto
    from app.models.asunto_paso import AsuntoPaso
    from app.models.user import User


class TareaTipo(StrEnum):
    COMPLETAR_PASO = "completar_paso"
    TAREA_INTERNA = "tarea_interna"
    REVISION = "revision"
    DECISION = "decision"
    SEGUIMIENTO = "seguimiento"
    CORRECCION = "correccion"


class TareaEstado(StrEnum):
    PENDIENTE = "pendiente"
    EN_PROGRESO = "en_progreso"
    COMPLETADA = "completada"
    CANCELADA = "cancelada"


class TareaPrioridad(StrEnum):
    BAJA = "baja"
    NORMAL = "normal"
    ALTA = "alta"
    URGENTE = "urgente"


class Tarea(BaseModel):
    """Trabajo asignable derivado de un expediente o de uno de sus pasos."""

    __tablename__ = "tareas"
    __table_args__ = (
        UniqueConstraint("asunto_id", "codigo", name="uq_tarea_asunto_codigo"),
        CheckConstraint(
            "estado IN ('pendiente', 'en_progreso', 'completada', 'cancelada')",
            name="ck_tarea_estado",
        ),
        CheckConstraint(
            "prioridad IN ('baja', 'normal', 'alta', 'urgente')",
            name="ck_tarea_prioridad",
        ),
        Index(
            "ix_tarea_bandeja",
            "firma_id",
            "responsable_id",
            "estado",
            "vence_en",
        ),
        Index("ix_tarea_asunto_estado", "firma_id", "asunto_id", "estado"),
    )

    asunto_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("asuntos.id"),
        nullable=False,
        index=True,
    )
    asunto_paso_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("asunto_pasos.id"),
        nullable=True,
        index=True,
    )
    codigo: Mapped[str] = mapped_column(String(100), nullable=False)
    tipo: Mapped[str] = mapped_column(
        String(40), nullable=False, default=TareaTipo.TAREA_INTERNA.value
    )
    titulo: Mapped[str] = mapped_column(String(180), nullable=False)
    instruccion: Mapped[str] = mapped_column(Text, nullable=False)
    consecuencia: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    estado: Mapped[str] = mapped_column(
        String(24),
        nullable=False,
        default=TareaEstado.PENDIENTE.value,
        index=True,
    )
    prioridad: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=TareaPrioridad.NORMAL.value,
        index=True,
    )
    vence_en: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    responsable_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    solicitante_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    resultado: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    asunto: Mapped["Asunto"] = relationship(
        "Asunto", back_populates="tareas", lazy="joined"
    )
    asunto_paso: Mapped[Optional["AsuntoPaso"]] = relationship(
        "AsuntoPaso", back_populates="tarea", lazy="joined"
    )
    responsable: Mapped["User"] = relationship(
        "User", foreign_keys=[responsable_id], lazy="joined"
    )
