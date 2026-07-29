import uuid
from datetime import date, datetime
from pydantic import BaseModel, Field
from typing import Optional, List
from app.schemas.base import BaseSchemaResponse
from app.schemas.novedad import NovedadResponse
from app.schemas.flujo import AsuntoPasoResponse

class EstadoProcesalResponse(BaseSchemaResponse):
    id: uuid.UUID
    nombre: str
    descripcion: Optional[str] = None
    color_tipo: str

class AsuntoCreate(BaseModel):
    # Código interno del expediente. La oficina no lo digita al aperturar un caso;
    # el backend lo asigna para no confundirlo con el radicado oficial del trámite.
    radicado: Optional[str] = Field(default=None, max_length=100)
    cliente_id: uuid.UUID
    abogado_id: Optional[uuid.UUID] = None
    estado_id: Optional[uuid.UUID] = None
    fecha_apertura: date = Field(default_factory=date.today)

class AsuntoUpdateEstado(BaseModel):
    estado_id: Optional[uuid.UUID] = None

class AsuntoResponse(BaseSchemaResponse):
    id: uuid.UUID
    radicado: str
    fecha_apertura: date
    etapa_actual: str
    siguiente_paso: str
    ruta_codigo: str
    paso_actual: int
    flujo_estado: str
    cliente_id: uuid.UUID
    abogado_id: Optional[uuid.UUID] = None
    estado: Optional[EstadoProcesalResponse] = None
    novedades: List[NovedadResponse] = Field(default_factory=list)
    pasos: List[AsuntoPasoResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
