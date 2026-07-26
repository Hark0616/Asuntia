import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Optional

class ClienteCreate(BaseModel):
    nombre: str
    cedula: str
    email: str
    telefono: Optional[str] = None

class ClienteResponse(BaseModel):
    id: uuid.UUID
    nombre: str
    cedula: str
    email: str
    telefono: Optional[str] = None
    rol: str = "cliente"
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
