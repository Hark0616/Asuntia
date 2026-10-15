import uuid
from datetime import date, datetime
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, StringConstraints, model_validator
from typing import Annotated, Literal, Optional, List
from app.schemas.base import BaseSchemaResponse
from app.schemas.novedad import NovedadResponse
from app.schemas.flujo import AsuntoPasoResponse
from app.schemas.cliente import ClienteCreate

class EstadoProcesalResponse(BaseSchemaResponse):
    id: uuid.UUID
    nombre: str
    descripcion: Optional[str] = None
    color_tipo: str

TituloAsunto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
CodigoAsunto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
RutaCodigo = Literal["insolvencia_persona_natural:v2"]


class AsuntoCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    titulo: TituloAsunto
    # Código interno del expediente. La oficina no lo digita al aperturar un caso;
    # el backend lo asigna para no confundirlo con el radicado oficial del trámite.
    codigo_interno: Optional[CodigoAsunto] = Field(
        default=None, validation_alias=AliasChoices("codigo_interno", "radicado")
    )
    radicado_oficial: Optional[CodigoAsunto] = None
    ruta_codigo: Optional[RutaCodigo] = None
    cliente_id: uuid.UUID
    abogado_id: Optional[uuid.UUID] = None
    estado_id: Optional[uuid.UUID] = None
    fecha_apertura: date = Field(default_factory=date.today)


class AperturaAsuntoCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    titulo: TituloAsunto
    radicado_oficial: Optional[CodigoAsunto] = None
    ruta_codigo: Optional[RutaCodigo] = None
    cliente_id: Optional[uuid.UUID] = None
    cliente_nuevo: Optional[ClienteCreate] = None
    abogado_id: Optional[uuid.UUID] = None
    fecha_apertura: date = Field(default_factory=date.today)

    @model_validator(mode="after")
    def validate_client_source(self):
        if (self.cliente_id is None) == (self.cliente_nuevo is None):
            raise ValueError(
                "Debes seleccionar un cliente o registrar uno nuevo"
            )
        return self

class AsuntoUpdateEstado(BaseModel):
    estado_id: Optional[uuid.UUID] = None


class AsuntoAsignarResponsable(BaseModel):
    responsable_id: uuid.UUID


class AsuntoIncorporarGuia(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ruta_codigo: RutaCodigo


class ClienteAsuntoResponse(BaseSchemaResponse):
    id: uuid.UUID
    nombre: str
    email: str
    numero_documento: str
    responsable_id: Optional[uuid.UUID] = None


class AsuntoListaResponse(BaseSchemaResponse):
    """Resumen de búsqueda: no carga documentos, pasos, tareas ni historia."""
    id: uuid.UUID
    titulo: str
    codigo_interno: str
    radicado_oficial: Optional[str] = None
    fecha_apertura: date
    cliente_id: uuid.UUID
    cliente_nombre: str
    abogado_id: Optional[uuid.UUID] = None
    responsable_nombre: Optional[str] = None
    estado_id: Optional[uuid.UUID] = None
    estado_nombre: Optional[str] = None
    estado_color: Optional[str] = None
    etapa_actual: str


class AsuntosPaginaResponse(BaseSchemaResponse):
    items: List[AsuntoListaResponse]
    total: int
    pagina: int
    por_pagina: int


class AsuntoResponse(BaseSchemaResponse):
    id: uuid.UUID
    titulo: str
    codigo_interno: str
    radicado_oficial: Optional[str] = None
    radicado: str
    fecha_apertura: date
    etapa_actual: str
    siguiente_paso: str
    ruta_codigo: Optional[str]
    paso_actual: Optional[int]
    flujo_estado: Optional[str]
    cliente_id: uuid.UUID
    cliente: ClienteAsuntoResponse
    abogado_id: Optional[uuid.UUID] = None
    estado: Optional[EstadoProcesalResponse] = None
    novedades: List[NovedadResponse] = Field(default_factory=list)
    pasos: List[AsuntoPasoResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
