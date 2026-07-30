import uuid
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
from app.schemas.base import BaseSchemaResponse

class NovedadCreate(BaseModel):
    titulo: str
    descripcion: str
    publicado_al_cliente: bool = True

class NovedadResponse(BaseSchemaResponse):
    id: uuid.UUID
    asunto_id: uuid.UUID
    asunto_paso_id: Optional[uuid.UUID] = None
    documento_id: Optional[uuid.UUID] = None
    tipo: str
    titulo: str
    descripcion: str
    publicado_al_cliente: bool
    created_at: datetime
