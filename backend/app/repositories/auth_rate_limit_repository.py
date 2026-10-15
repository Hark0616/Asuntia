import math
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import case, func, or_, select
from sqlalchemy.dialects.postgresql import insert

from app.models.auth_rate_limit import AuthRateLimit
from app.repositories.base import BaseRepository


class AuthRateLimitRepository(BaseRepository[AuthRateLimit]):
    def __init__(self, session, firma_id: uuid.UUID):
        super().__init__(AuthRateLimit, session, firma_id)

    async def consume(self, key_hash: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        """UPSERT condicional: nunca concede dos veces el último cupo disponible."""
        expired = AuthRateLimit.expires_at <= func.now()
        expires_at = func.now() + timedelta(seconds=window_seconds)
        result = await self.session.execute(
            insert(AuthRateLimit).values(firma_id=self.firma_id, key_hash=key_hash,
                attempts=1, expires_at=expires_at)
            .on_conflict_do_update(constraint="uq_auth_rate_limit_key", set_={
                "attempts": case((expired, 1), else_=AuthRateLimit.attempts + 1),
                "expires_at": case((expired, expires_at), else_=AuthRateLimit.expires_at),
                "updated_at": func.now(),
            }, where=(AuthRateLimit.firma_id == self.firma_id) & AuthRateLimit.is_active.is_(True)
               & or_(expired, AuthRateLimit.attempts < limit))
            .returning(AuthRateLimit.expires_at)
        )
        if result.scalar_one_or_none() is not None:
            return True, 0
        deadline = await self.session.scalar(select(AuthRateLimit.expires_at).where(
            AuthRateLimit.firma_id == self.firma_id, AuthRateLimit.is_active.is_(True),
            AuthRateLimit.key_hash == key_hash))
        retry = math.ceil((deadline - datetime.now(timezone.utc)).total_seconds()) if deadline else window_seconds
        return False, max(1, retry)
