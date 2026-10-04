import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field


class PasoCampoResponse(BaseModel):
    clave: str
    etiqueta: str
    tipo: Literal["text", "textarea", "date", "datetime", "url", "select", "boolean"]
    requerido: bool = True
    opciones: list[dict[str, str]] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class AsuntoPasoResponse(BaseModel):
    id: uuid.UUID
    orden: int
    codigo: str
    titulo: str
    descripcion: str
    estado: Literal["bloqueado", "activo", "completado"]
    campos: list[PasoCampoResponse]
    datos: dict[str, Any]
    updated_at: datetime
    completed_at: datetime | None = None
    completed_by_id: uuid.UUID | None = None

    model_config = ConfigDict(from_attributes=True)


class AvanzarPasoRequest(BaseModel):
    paso_codigo: str = Field(min_length=1)
    datos: dict[str, Any] = Field(default_factory=dict)
    expected_updated_at: AwareDatetime | None = None

    model_config = ConfigDict(extra="forbid")


class GuardarPasoBorradorRequest(BaseModel):
    paso_codigo: str = Field(min_length=1)
    datos: dict[str, Any]
    expected_updated_at: AwareDatetime

    model_config = ConfigDict(extra="forbid")
