import uuid
from datetime import date
from typing import Optional, List
from sqlalchemy import Date, Integer, String, ForeignKey, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.models.base import BaseModel

class Asunto(BaseModel):
    """
    Expediente jurídico general, con guía de procedimiento opcional.
    """
    __tablename__ = "asuntos"
    __table_args__ = (
        UniqueConstraint("firma_id", "radicado", name="uq_asuntos_firma_codigo_interno"),
    )

    # Conserva el nombre físico histórico sin duplicar la identidad del expediente.
    codigo_interno: Mapped[str] = mapped_column("radicado", String(100), nullable=False, index=True)
    radicado = synonym("codigo_interno")
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    radicado_oficial: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    fecha_apertura: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        default=date.today,
        server_default=text("CURRENT_DATE"),
    )
    
    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id"), nullable=False, index=True
    )
    
    abogado_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    
    estado_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("estados_procesales.id"), nullable=True
    )

    etapa_actual: Mapped[str] = mapped_column(
        String(255), nullable=False, default="Sin guía"
    )
    
    siguiente_paso: Mapped[str] = mapped_column(
        String(255), nullable=False, default="Sin acción de guía"
    )

    ruta_codigo: Mapped[Optional[str]] = mapped_column(
        String(80),
        nullable=True,
    )

    paso_actual: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )

    flujo_estado: Mapped[Optional[str]] = mapped_column(
        String(30), nullable=True
    )

    google_drive_folder_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )

    storage_folders: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True, default=dict
    )

    # Relaciones
    cliente: Mapped["Cliente"] = relationship(
        "Cliente",
        foreign_keys=[cliente_id],
        back_populates="asuntos",
        lazy="joined",
    )
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
    tareas: Mapped[List["Tarea"]] = relationship(
        "Tarea",
        back_populates="asunto",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="Tarea.created_at",
    )
