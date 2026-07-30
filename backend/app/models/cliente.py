import uuid
from datetime import date
from typing import List, Optional

from sqlalchemy import Date, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Cliente(BaseModel):
    """Perfil permanente de una persona o empresa atendida por la firma."""

    __tablename__ = "clientes"
    __table_args__ = (
        Index(
            "uq_clientes_firma_documento",
            "firma_id",
            "numero_documento_normalizado",
            unique=True,
        ),
    )

    tipo_persona: Mapped[str] = mapped_column(
        String(20), nullable=False, default="natural", server_default="natural"
    )
    tipo_documento: Mapped[str] = mapped_column(
        String(20), nullable=False, default="CC", server_default="CC"
    )
    numero_documento: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    numero_documento_normalizado: Mapped[str] = mapped_column(
        String(50), nullable=False
    )
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    telefono: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    fecha_expedicion: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    direccion: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    direccion_notificacion: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    ciudad: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    departamento: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    canal_preferido: Mapped[str] = mapped_column(
        String(20), nullable=False, default="email", server_default="email"
    )
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    portal_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
        unique=True,
    )

    portal_user: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[portal_user_id], lazy="joined"
    )
    asuntos: Mapped[List["Asunto"]] = relationship(
        "Asunto", back_populates="cliente", lazy="raise"
    )

    @property
    def asuntos_count(self) -> int:
        asuntos = self.__dict__.get("asuntos", ())
        return sum(1 for asunto in asuntos if asunto.is_active)

    @property
    def cedula(self) -> str:
        """Alias temporal para clientes de API anteriores."""
        return self.numero_documento

    @property
    def rol(self) -> str:
        """Compatibilidad temporal con la antigua representación como usuario."""
        return "cliente"
