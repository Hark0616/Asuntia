import hashlib
import hmac
import json

from app.config import settings
from app.core.exceptions import DomainException
from app.repositories.auth_rate_limit_repository import AuthRateLimitRepository


class AuthRateLimiter:
    def __init__(self, session, firma_id):
        self.session = session
        self.repo = AuthRateLimitRepository(session, firma_id)

    @staticmethod
    def key(action, kind, value):
        # Codificación inequívoca, sin correos, documentos o direcciones en BD/logs.
        payload = json.dumps([action, kind, value], ensure_ascii=True).encode()
        return hmac.new(settings.JWT_SECRET.encode(), payload, hashlib.sha256).hexdigest()

    async def check(self, action: str, identity: str, peer: str, identity_limit: int):
        for kind, value, limit in (("ip", peer, settings.AUTH_IP_LIMIT),
                                    ("identity", identity, identity_limit)):
            allowed, retry = await self.repo.consume(self.key(action, kind, value), limit, settings.AUTH_WINDOW_SECONDS)
            if not allowed:
                # Los intentos admitidos antes del rechazo también consumen presupuesto.
                await self.session.commit()
                error = DomainException(detail="Demasiados intentos. Inténtalo más tarde", status_code=429)
                error.headers = {"Retry-After": str(retry)}
                raise error
        await self.session.commit()
