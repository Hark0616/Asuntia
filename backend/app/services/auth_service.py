import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import UnauthorizedException
from app.core.security import verify_password
from app.models.firma import Firma
from app.models.user import User
from app.repositories.auth_challenge_repository import AuthChallengeRepository
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.firma_repository import FirmaRepository
from app.repositories.user_repository import UserRepository


class AuthService:
    OFFICE_ROLES = {"administrador", "abogado", "auxiliar"}
    CLIENT_LOGIN_PURPOSE = "client_login"
    OTP_TTL_MINUTES = 10
    OTP_MAX_ATTEMPTS = 5

    def __init__(self, session: AsyncSession):
        self.session = session

    async def resolve_firma(self, firma_slug: str) -> Firma:
        firma = await FirmaRepository(self.session).get_by_subdominio(firma_slug)
        if not firma:
            raise UnauthorizedException(detail="Credenciales incorrectas")
        return firma

    async def authenticate_office(
        self, firma_slug: str, email: str, password: str
    ) -> User:
        firma = await self.resolve_firma(firma_slug)
        user = await UserRepository(
            self.session, firma.id
        ).get_office_by_email(email)
        if (
            not user
            or user.rol not in self.OFFICE_ROLES
            or not user.hashed_password
            or not verify_password(password, user.hashed_password)
        ):
            raise UnauthorizedException(detail="Correo o contraseña incorrectos")
        return user

    async def issue_client_otp(
        self, firma_slug: str, cedula: str
    ) -> tuple[User | None, str | None, str | None]:
        try:
            firma = await self.resolve_firma(firma_slug)
        except UnauthorizedException:
            return None, None, None

        cliente = await ClienteRepository(
            self.session, firma.id
        ).get_by_document(cedula)
        if not cliente or not cliente.portal_user_id:
            return None, None, None
        user = await UserRepository(
            self.session, firma.id
        ).get_by_id(cliente.portal_user_id)
        if not user or user.rol != "cliente":
            return None, None, None

        repo = AuthChallengeRepository(self.session, firma.id)
        await repo.deactivate_for_user(user.id, self.CLIENT_LOGIN_PURPOSE)
        otp_code = (
            "12345"
            if settings.ENVIRONMENT == "development"
            else f"{secrets.randbelow(1_000_000):06d}"
        )
        await repo.create(
            {
                "user_id": user.id,
                "purpose": self.CLIENT_LOGIN_PURPOSE,
                "code_hash": self._hash_code(otp_code),
                "expires_at": datetime.now(timezone.utc)
                + timedelta(minutes=self.OTP_TTL_MINUTES),
                "attempts": 0,
            },
            created_by_id=user.id,
        )
        return user, otp_code, cliente.email

    async def verify_client_otp(
        self, firma_slug: str, cedula: str, code: str
    ) -> User:
        firma = await self.resolve_firma(firma_slug)
        cliente = await ClienteRepository(
            self.session, firma.id
        ).get_by_document(cedula)
        if not cliente or not cliente.portal_user_id:
            raise self._invalid_otp()
        user = await UserRepository(
            self.session, firma.id
        ).get_by_id(cliente.portal_user_id)
        if not user or user.rol != "cliente":
            raise self._invalid_otp()

        repo = AuthChallengeRepository(self.session, firma.id)
        challenge = await repo.get_latest_active(
            user.id, self.CLIENT_LOGIN_PURPOSE
        )
        now = datetime.now(timezone.utc)
        if not challenge or now >= challenge.expires_at:
            if challenge:
                await repo.update(challenge, {"is_active": False})
            raise self._invalid_otp()

        attempts = challenge.attempts + 1
        valid_code = code.isdigit() and hmac.compare_digest(
            challenge.code_hash, self._hash_code(code)
        )
        if attempts > self.OTP_MAX_ATTEMPTS or not valid_code:
            await repo.update(
                challenge,
                {
                    "attempts": attempts,
                    "is_active": attempts < self.OTP_MAX_ATTEMPTS,
                },
            )
            raise self._invalid_otp()

        await repo.update(
            challenge,
            {
                "attempts": attempts,
                "consumed_at": now,
                "is_active": False,
            },
        )
        return user

    @staticmethod
    def _hash_code(code: str) -> str:
        return hmac.new(
            settings.JWT_SECRET.encode(),
            code.encode(),
            hashlib.sha256,
        ).hexdigest()

    @staticmethod
    def _invalid_otp() -> UnauthorizedException:
        return UnauthorizedException(detail="Código OTP inválido o expirado")
