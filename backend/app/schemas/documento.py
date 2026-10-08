import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel as PydanticBaseModel, ConfigDict
from app.models.documento import DocumentoAsunto
from app.schemas.base import BaseSchemaResponse

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
    asunto_paso_id: Optional[uuid.UUID] = None
    nombre_funcional: str
    tipo_documental: str
    subcarpeta: str
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


class DocumentoPortalResponse(BaseSchemaResponse):
    """Documento compartido sin metadatos internos ni rutas de almacenamiento."""

    id: uuid.UUID
    nombre_funcional: str
    tipo_documental: str
    subcarpeta: str
    provider: str
    web_view_url: str
    mime_type: Optional[str] = None
    compartido_con_cliente: bool
    created_at: datetime

    @classmethod
    def from_documento(cls, documento: DocumentoAsunto) -> "DocumentoPortalResponse":
        return cls(
            id=documento.id,
            nombre_funcional=documento.nombre_funcional,
            tipo_documental=documento.tipo_documental,
            subcarpeta=documento.subcarpeta,
            provider=documento.provider,
            web_view_url=(
                f"/api/v1/documentos/{documento.id}/preview"
                if documento.provider == "local"
                else documento.web_view_url
            ),
            mime_type=documento.mime_type,
            compartido_con_cliente=documento.compartido_con_cliente,
            created_at=documento.created_at,
        )
