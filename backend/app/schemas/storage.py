import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class StorageConnectionResponse(BaseModel):
    id: uuid.UUID
    provider: str
    account_name: str | None
    root_folder_id: str | None
    root_folder_name: str | None
    is_active: bool
    model_config = ConfigDict(from_attributes=True)


class StorageStatusResponse(BaseModel):
    provider: str
    configured: bool
    worker_ready: bool
    connection_id: uuid.UUID | None = None
    connections: list[StorageConnectionResponse]
    model_config = ConfigDict(from_attributes=True)


class StorageOperationResponse(BaseModel):
    id: uuid.UUID
    kind: str
    status: str
    result: dict[str, Any] | None = None
    error_code: str | None = None
    error_message: str | None = None
    expires_at: datetime
    model_config = ConfigDict(from_attributes=True)


class StorageCommand(BaseModel):
    operation_id: uuid.UUID
    action: Literal["browse", "root", "bind_case", "link", "download", "refresh"]
    connection_id: uuid.UUID | None = None
    asunto_id: uuid.UUID | None = None
    documento_id: uuid.UUID | None = None
    item_id: str | None = Field(default=None, max_length=255)
    cursor: uuid.UUID | None = None
    nombre_funcional: str | None = Field(default=None, max_length=255)
    tipo_documental: Literal["anexo", "escrito_solicitud", "auto_admisorio", "acta_audiencia", "acta_acuerdo", "poder", "comunicacion_juzgado", "otro"] = "otro"
    compartido_con_cliente: bool = False
    for_binding: bool = False


class StorageDestinationUpdate(BaseModel):
    provider: Literal["local", "onedrive"]
    connection_id: uuid.UUID | None = None
