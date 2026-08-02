import uuid

from app.schemas.base import BaseSchemaResponse


class ResponsableAsuntoResponse(BaseSchemaResponse):
    id: uuid.UUID
    nombre: str
    rol: str
