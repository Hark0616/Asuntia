from typing import Optional
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import BaseModel

class User(BaseModel):
    """
    Modelo de Usuarios del Sistema (Oficina y Clientes).
    """
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True) # Null si es solo cliente OTP
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    cedula: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    rol: Mapped[str] = mapped_column(String(50), nullable=False, default="cliente") # administrador | abogado | auxiliar | cliente
    telefono: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
