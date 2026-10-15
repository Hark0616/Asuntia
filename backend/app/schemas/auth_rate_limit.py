import uuid
from datetime import datetime

from app.schemas.base import BaseSchemaResponse


class AuthRateLimitResponse(BaseSchemaResponse):
    id: uuid.UUID
    firma_id: uuid.UUID
    key_hash: str
    attempts: int
    expires_at: datetime
