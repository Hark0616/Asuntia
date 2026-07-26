import uuid
from typing import Optional
from sqlalchemy import String, Boolean, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import BaseModel

class Novedad(BaseModel):
    """
    Modelo para las Novedades / Avances Procesales de un Asunto.
    """
    __tablename__ = "novedades"

    asunto_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("asuntos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    publicado_al_cliente: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    # Relación
    asunto: Mapped["Asunto"] = relationship("Asunto", back_populates="novedades")
