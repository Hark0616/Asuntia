import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class PasoCampoResponse(BaseModel):
    clave: str
    etiqueta: str
    tipo: Literal["text", "textarea", "date", "datetime", "url", "select", "boolean"]
    requerido: bool = True
    opciones: list[dict[str, str]] = Field(default_factory=list)


class AsuntoPasoResponse(BaseModel):
    id: uuid.UUID
    orden: int
    codigo: str
    titulo: str
    descripcion: str
    estado: Literal["bloqueado", "activo", "completado"]
    campos: list[PasoCampoResponse]
    datos: dict[str, Any]
    completed_at: datetime | None = None
    completed_by_id: uuid.UUID | None = None

    model_config = ConfigDict(from_attributes=True)


class AvanzarPasoRequest(BaseModel):
    paso_codigo: str
    datos: dict[str, Any] = Field(default_factory=dict)
