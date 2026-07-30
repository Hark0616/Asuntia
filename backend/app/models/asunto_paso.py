import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.asunto import Asunto
    from app.models.tarea import Tarea


class AsuntoPaso(BaseModel):
    """Paso persistente de la ruta de trabajo de un expediente."""

    __tablename__ = "asunto_pasos"
    __table_args__ = (
        UniqueConstraint("asunto_id", "orden", name="uq_asunto_paso_orden"),
        UniqueConstraint("asunto_id", "codigo", name="uq_asunto_paso_codigo"),
        Index(
            "uq_asunto_paso_activo",
            "asunto_id",
            unique=True,
            postgresql_where=text("estado = 'activo' AND is_active = true"),
        ),
    )

    asunto_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("asuntos.id"),
        nullable=False,
        index=True,
    )
    orden: Mapped[int] = mapped_column(Integer, nullable=False)
    codigo: Mapped[str] = mapped_column(String(80), nullable=False)
    titulo: Mapped[str] = mapped_column(String(160), nullable=False)
    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)
    estado: Mapped[str] = mapped_column(
        String(30), nullable=False, default="bloqueado", index=True
    )
    campos: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list
    )
    datos: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    asunto: Mapped["Asunto"] = relationship("Asunto", back_populates="pasos")
    tarea: Mapped[Optional["Tarea"]] = relationship(
        "Tarea", back_populates="asunto_paso", uselist=False
    )
