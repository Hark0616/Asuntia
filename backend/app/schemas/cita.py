import uuid
from datetime import datetime, timedelta
from typing import Literal
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.base import BaseSchemaResponse
from app.schemas.tarea import TareaPersonaResumen


class CitaDatos(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    tipo: Literal["reunion", "audiencia"]
    titulo: str = Field(min_length=1, max_length=180)
    inicio: AwareDatetime
    fin: AwareDatetime
    zona_horaria: str = Field(default="America/Bogota", max_length=80)
    responsable_id: uuid.UUID
    participantes_ids: list[uuid.UUID] = Field(default_factory=list, max_length=30)
    lugar: str | None = Field(default=None, max_length=300)
    enlace: str | None = Field(default=None, max_length=1000)
    resumen: str | None = Field(default=None, max_length=4000)

    @field_validator("zona_horaria")
    @classmethod
    def zona_valida(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Zona horaria desconocida")
        return value

    @field_validator("enlace")
    @classmethod
    def enlace_seguro(cls, value):
        if value:
            try:
                url = urlsplit(value)
                if url.scheme != "https" or not url.hostname or url.username or url.password or any(c.isspace() for c in value):
                    raise ValueError
                url.port
            except ValueError:
                raise ValueError("Usa un enlace HTTPS válido y sin credenciales")
        return value or None

    @model_validator(mode="after")
    def intervalo(self):
        if not timedelta(0) < self.fin - self.inicio <= timedelta(hours=24):
            raise ValueError("La cita debe terminar después de iniciar y durar hasta 24 horas")
        self.participantes_ids = sorted(set(self.participantes_ids), key=str)
        return self


class CitaCreate(CitaDatos):
    asunto_id: uuid.UUID
    operacion_id: uuid.UUID


class CitaUpdate(CitaDatos):
    expected_updated_at: AwareDatetime


class CitaCancelar(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    expected_updated_at: AwareDatetime
    motivo: str = Field(min_length=1, max_length=500)


class CitaCambioResponse(BaseSchemaResponse):
    id: uuid.UUID
    accion: str
    datos: dict
    created_at: datetime
    created_by_id: uuid.UUID | None
    autor: TareaPersonaResumen | None = None


class CitaResponse(BaseSchemaResponse):
    id: uuid.UUID
    asunto_id: uuid.UUID
    tipo: Literal["reunion", "audiencia"]
    titulo: str
    inicio: datetime
    fin: datetime | None
    zona_horaria: str
    responsable_id: uuid.UUID
    responsable: TareaPersonaResumen
    participantes_ids: list[uuid.UUID]
    lugar: str | None
    enlace: str | None
    resumen: str | None
    estado: Literal["programada", "cancelada"]
    motivo_cancelacion: str | None
    created_at: datetime
    updated_at: datetime
    created_by_id: uuid.UUID | None

