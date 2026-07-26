from sqlalchemy import String, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import BaseModel

class EstadoProcesal(BaseModel):
    """
    Modelo para el Catálogo de Estados Procesales del Expediente.
    """
    __tablename__ = "estados_procesales"

    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    descripcion: Mapped[str] = mapped_column(String(255), nullable=True)
    color_tipo: Mapped[str] = mapped_column(String(50), nullable=False, default="mint") # mint | warning | danger | blue | purple | grey
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
