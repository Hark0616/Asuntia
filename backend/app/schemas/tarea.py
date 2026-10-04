import uuid
from datetime import datetime
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

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


class TareaCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    asunto_id: uuid.UUID
    titulo: str = Field(min_length=1, max_length=180)
    instruccion: str = Field(min_length=1, max_length=2000)
    responsable_id: uuid.UUID
    prioridad: Literal["baja", "normal", "alta", "urgente"] = "normal"
    vence_en: AwareDatetime | None = None


class TareaUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    expected_updated_at: AwareDatetime
    titulo: str | None = Field(default=None, min_length=1, max_length=180)
    instruccion: str | None = Field(default=None, min_length=1, max_length=2000)
    responsable_id: uuid.UUID | None = None
    prioridad: Literal["baja", "normal", "alta", "urgente"] | None = None
    vence_en: AwareDatetime | None = None
    estado: Literal["pendiente", "en_progreso", "completada", "cancelada"] | None = None


class AgendaItemResponse(BaseSchemaResponse):
    id: str
    origen: Literal["tarea", "audiencia"]
    titulo: str
    fecha: datetime
    asunto: TareaAsuntoResumen
    responsable: TareaPersonaResumen


class AgendaResponse(BaseSchemaResponse):
    items: list[AgendaItemResponse] = Field(default_factory=list)
    total: int
