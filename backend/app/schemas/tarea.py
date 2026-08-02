import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.base import BaseSchemaResponse


class TareaPersonaResumen(BaseSchemaResponse):
    id: uuid.UUID
    nombre: str


class TareaAsuntoResumen(BaseSchemaResponse):
    id: uuid.UUID
    radicado: str
    etapa_actual: str
    cliente: TareaPersonaResumen


class TareaResponse(BaseSchemaResponse):
    id: uuid.UUID
    tipo: str
    titulo: str
    instruccion: str
    consecuencia: str | None = None
    estado: Literal["pendiente", "en_progreso", "completada", "cancelada"]
    prioridad: Literal["baja", "normal", "alta", "urgente"]
    vence_en: datetime | None = None
    asunto: TareaAsuntoResumen
    responsable: TareaPersonaResumen
    created_at: datetime
    updated_at: datetime


class MiTrabajoResponse(BaseSchemaResponse):
    items: list[TareaResponse] = Field(default_factory=list)
    total: int
