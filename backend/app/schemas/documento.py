import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel as PydanticBaseModel, ConfigDict

class DocumentoCreate(PydanticBaseModel):
    nombre_funcional: str
    tipo_documental: str = "otro"
    compartido_con_cliente: bool = False
    estado_revision: str = "recibido"

class DocumentoUpdate(PydanticBaseModel):
    nombre_funcional: Optional[str] = None
    tipo_documental: Optional[str] = None
    compartido_con_cliente: Optional[bool] = None
    estado_revision: Optional[str] = None

class DocumentoLinkCreate(PydanticBaseModel):
    nombre_funcional: str
    tipo_documental: str = "otro"
    external_file_id: str
    web_view_url: str
    web_download_url: Optional[str] = None
    mime_type: Optional[str] = "application/pdf"
    tamano_bytes: Optional[int] = 0
    compartido_con_cliente: bool = False

class DocumentoResponse(PydanticBaseModel):
    id: uuid.UUID
    firma_id: uuid.UUID
    asunto_id: uuid.UUID
    nombre_funcional: str
    tipo_documental: str
    provider: str
    external_file_id: str
    web_view_url: str
    web_download_url: Optional[str] = None
    mime_type: Optional[str] = None
    tamano_bytes: Optional[int] = None
    compartido_con_cliente: bool
    estado_revision: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
