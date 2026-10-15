import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator

from app.schemas.base import BaseSchemaResponse
from app.schemas.auth import FirmaSlug, NewPassword

OfficeRole = Literal["administrador", "abogado", "auxiliar"]
RequiredName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]


class ResponsableAsuntoResponse(BaseSchemaResponse):
    id: uuid.UUID
    nombre: str
    rol: str


class MiembroEquipoResponse(BaseSchemaResponse):
    id: uuid.UUID
    nombre: str
    email: str
    cedula: str
    rol: OfficeRole
    estado: Literal["activo", "invitado", "inactivo"]
    updated_at: datetime
    clientes: int = 0
    asuntos: int = 0
    tareas_pendientes: int = 0
    tareas_fuera_de_asuntos: int = 0


class InvitacionEquipoCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    nombre: RequiredName
    email: EmailStr
    cedula: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
    rol: OfficeRole

    @field_validator("cedula")
    @classmethod
    def valid_document(cls, value):
        if not any(character.isalnum() for character in value):
            raise ValueError("Documento inválido")
        return value


class EquipoVersion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_updated_at: AwareDatetime


class CambioRolEquipo(EquipoVersion):
    rol: OfficeRole
    reasignar_a_id: uuid.UUID | None = None


class BajaEquipo(EquipoVersion):
    reasignar_a_id: uuid.UUID | None = None


class InvitacionEquipoResponse(BaseSchemaResponse):
    miembro: MiembroEquipoResponse
    firma_slug: str
    invitacion_id: uuid.UUID
    token: str
    expires_at: datetime


class ActivarEquipoRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    firma_slug: FirmaSlug
    invitacion_id: uuid.UUID
    token: str = Field(min_length=43, max_length=43)
    password: NewPassword
