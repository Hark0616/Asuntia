import uuid
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import AliasChoices, AwareDatetime, BaseModel, ConfigDict, EmailStr, Field, model_validator

class ClienteCreate(BaseModel):
    tipo_persona: Literal["natural", "juridica"] = "natural"
    tipo_documento: Literal["CC", "CE", "NIT", "PASAPORTE", "OTRO"] = "CC"
    numero_documento: str = Field(
        min_length=3,
        max_length=50,
        validation_alias=AliasChoices("numero_documento", "cedula"),
    )
    nombre: str = Field(min_length=2, max_length=255)
    email: EmailStr
    telefono: Optional[str] = None
    fecha_expedicion: Optional[date] = None
    direccion: Optional[str] = Field(default=None, max_length=255)
    direccion_notificacion: Optional[str] = Field(default=None, max_length=255)
    ciudad: Optional[str] = Field(default=None, max_length=120)
    departamento: Optional[str] = Field(default=None, max_length=120)
    canal_preferido: Literal["email", "telefono", "whatsapp"] = "email"
    observaciones: Optional[str] = Field(default=None, max_length=2000)
    habilitar_portal: bool = True

class ClienteResponse(BaseModel):
    id: uuid.UUID
    tipo_persona: str
    tipo_documento: str
    numero_documento: str
    # Alias de lectura durante la transición del frontend legado.
    cedula: str
    nombre: str
    email: str
    telefono: Optional[str] = None
    fecha_expedicion: Optional[date] = None
    direccion: Optional[str] = None
    direccion_notificacion: Optional[str] = None
    ciudad: Optional[str] = None
    departamento: Optional[str] = None
    canal_preferido: str
    observaciones: Optional[str] = None
    portal_user_id: Optional[uuid.UUID] = None
    responsable_id: Optional[uuid.UUID] = None
    portal_habilitado: bool
    asuntos_count: int = 0
    rol: str = "cliente"
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClienteAsignarResponsable(BaseModel):
    responsable_id: uuid.UUID


class ClienteUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    expected_updated_at: AwareDatetime
    tipo_persona: Literal["natural", "juridica"] | None = None
    tipo_documento: Literal["CC", "CE", "NIT", "PASAPORTE", "OTRO"] | None = None
    numero_documento: str | None = Field(default=None, min_length=3, max_length=50)
    nombre: str | None = Field(default=None, min_length=2, max_length=255)
    email: EmailStr | None = None
    telefono: str | None = Field(default=None, max_length=50)
    fecha_expedicion: date | None = None
    direccion: str | None = Field(default=None, max_length=255)
    direccion_notificacion: str | None = Field(default=None, max_length=255)
    ciudad: str | None = Field(default=None, max_length=120)
    departamento: str | None = Field(default=None, max_length=120)
    canal_preferido: Literal["email", "telefono", "whatsapp"] | None = None
    observaciones: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validate_changes(self):
        changes = self.model_fields_set - {"expected_updated_at"}
        if not changes:
            raise ValueError("Debes indicar los datos que deseas corregir")
        required = {"tipo_persona", "tipo_documento", "numero_documento", "nombre", "email", "canal_preferido"}
        if any(getattr(self, field) is None for field in changes & required):
            raise ValueError("Los datos obligatorios no pueden quedar vacíos")
        if self.numero_documento is not None and not any(c.isalnum() for c in self.numero_documento):
            raise ValueError("Identificación inválida")
        return self
