import uuid
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, List
from app.schemas.base import BaseSchemaResponse
from app.schemas.novedad import NovedadResponse
from app.schemas.flujo import AsuntoPasoResponse

class EstadoProcesalResponse(BaseSchemaResponse):
    id: uuid.UUID
    nombre: str
    color_tipo: str

class AsuntoCreate(BaseModel):
    radicado: str
    cliente_id: uuid.UUID
    abogado_id: Optional[uuid.UUID] = None
    estado_id: Optional[uuid.UUID] = None

class AsuntoUpdateEstado(BaseModel):
    estado_id: Optional[uuid.UUID] = None
    etapa_actual: Optional[str] = None
    siguiente_paso: Optional[str] = None

class AsuntoResponse(BaseSchemaResponse):
    id: uuid.UUID
    radicado: str
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
