import uuid
from typing import Optional, List
from sqlalchemy import Integer, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.models.base import BaseModel

class Asunto(BaseModel):
    """
    Modelo del Expediente de Insolvencia de Persona Natural.
    """
    __tablename__ = "asuntos"

    radicado: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    
    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    
    abogado_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    
    estado_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("estados_procesales.id"), nullable=True
    )

    etapa_actual: Mapped[str] = mapped_column(
        String(255), nullable=False, default="Etapa 1: Evaluación y Radicación"
    )
    
    siguiente_paso: Mapped[str] = mapped_column(
        String(255), nullable=False, default="Revisión inicial de documentación"
    )

    ruta_codigo: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
        default="insolvencia_persona_natural",
        server_default="insolvencia_persona_natural",
    )

    paso_actual: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )

    flujo_estado: Mapped[str] = mapped_column(
        String(30), nullable=False, default="activo", server_default="activo"
    )

    google_drive_folder_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )

    storage_folders: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True, default=dict
    )

    # Relaciones
    cliente: Mapped["User"] = relationship("User", foreign_keys=[cliente_id], lazy="joined")
    abogado: Mapped[Optional["User"]] = relationship("User", foreign_keys=[abogado_id], lazy="joined")
    estado: Mapped[Optional["EstadoProcesal"]] = relationship("EstadoProcesal", lazy="joined")
    novedades: Mapped[List["Novedad"]] = relationship("Novedad", back_populates="asunto", lazy="selectin", cascade="all, delete-orphan")
    documentos: Mapped[List["DocumentoAsunto"]] = relationship("DocumentoAsunto", back_populates="asunto", lazy="selectin", cascade="all, delete-orphan")
    pasos: Mapped[List["AsuntoPaso"]] = relationship(
        "AsuntoPaso",
        back_populates="asunto",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="AsuntoPaso.orden",
    )
