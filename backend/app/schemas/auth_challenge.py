import uuid
from datetime import datetime

from app.schemas.base import BaseSchemaResponse


class AuthChallengeResponse(BaseSchemaResponse):
    id: uuid.UUID
    user_id: uuid.UUID
    purpose: str
    expires_at: datetime
    attempts: int
    consumed_at: datetime | None = None
