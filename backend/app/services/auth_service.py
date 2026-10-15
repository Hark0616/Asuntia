import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.core.exceptions import DomainException, UnauthorizedException
from app.core.security import decode_access_token, get_password_hash, verify_password
from app.models.firma import Firma
from app.models.user import User
from app.repositories.auth_challenge_repository import AuthChallengeRepository
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.firma_repository import FirmaRepository
from app.repositories.user_repository import UserRepository
from app.services.auth_rate_limit_service import AuthRateLimiter


_DUMMY_PASSWORD_HASH = get_password_hash("asuntia-no-account-placeholder")


class AuthService:
    OFFICE_ROLES = {"administrador", "abogado", "auxiliar"}
    CLIENT_LOGIN_PURPOSE = "client_login"
    PASSWORD_RESET_PURPOSE = "office_password_reset"

    def __init__(self, session: AsyncSession):
        self.session = session

    async def revoke_sessions(self, access_token: str | None) -> None:
        """Cerrar sesión revoca todos los tokens vigentes de esta identidad."""
        payload = decode_access_token(access_token) if access_token else None
        if not payload:
            return
        try:
            user_id, firma_id = uuid.UUID(payload["sub"]), uuid.UUID(payload["firma_id"])
        except (KeyError, TypeError, ValueError):
            return
        if not await FirmaRepository(self.session).lock_active(firma_id):
            return
        user = await UserRepository(self.session, firma_id).get_by_id(user_id)
        if (user and user.rol == payload.get("rol")
                and user.updated_at.isoformat() == payload.get("user_revision")):
            user.updated_at = datetime.now(timezone.utc)
            await self.session.commit()

    async def resolve_firma(self, firma_slug: str) -> Firma:
        firma = await FirmaRepository(self.session).get_by_subdominio(firma_slug)
        if not firma:
            raise UnauthorizedException(detail="Credenciales incorrectas")
        return firma

    async def authenticate_office(
        self, firma_slug: str, email: str, password: str, peer: str = "unknown",
    ) -> User:
        try:
            firma = await self.resolve_firma(firma_slug)
        except UnauthorizedException:
            await run_in_threadpool(verify_password, password, _DUMMY_PASSWORD_HASH)
            raise UnauthorizedException(detail="Correo o contraseña incorrectos")
        await AuthRateLimiter(self.session, firma.id).check(
            "office-login", email.strip().lower(), peer, settings.AUTH_LOGIN_LIMIT)
        user = await UserRepository(
            self.session, firma.id
        ).get_office_by_email(email)
        correct = await run_in_threadpool(verify_password, password,
            user.hashed_password if user and user.hashed_password else _DUMMY_PASSWORD_HASH)
        if not user or user.rol not in self.OFFICE_ROLES or not user.hashed_password or not correct:
            raise UnauthorizedException(detail="Correo o contraseña incorrectos")
        return user

    async def issue_client_otp(
        self, firma_slug: str, cedula: str, peer: str = "unknown",
    ) -> tuple[User | None, str | None, str | None]:
        try:
            firma = await self.resolve_firma(firma_slug)
        except UnauthorizedException:
            return None, None, None

        await AuthRateLimiter(self.session, firma.id).check(
            "otp-request", UserRepository.normalize_cedula(cedula), peer, settings.AUTH_OTP_REQUEST_LIMIT)
        if not await FirmaRepository(self.session).lock_active(firma.id):
            return None, None, None

        cliente = await ClienteRepository(
            self.session, firma.id
        ).get_by_document(cedula)
        if not cliente or not cliente.portal_user_id:
            await self.session.rollback()
            return None, None, None
        user = await UserRepository(
            self.session, firma.id
        ).get_by_id(cliente.portal_user_id)
        if not user or user.rol != "cliente":
            await self.session.rollback()
            return None, None, None

        repo = AuthChallengeRepository(self.session, firma.id)
        await repo.stage_revoke(user.id, self.CLIENT_LOGIN_PURPOSE)
        otp_code = (
            "12345"
            if settings.ENVIRONMENT == "development"
            else f"{secrets.randbelow(1_000_000):06d}"
        )
        await repo.stage_create(user.id, self.CLIENT_LOGIN_PURPOSE, self._hash_code(otp_code),
            datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_TTL_MINUTES), None)
        await self.session.commit()
        return user, otp_code, cliente.email

    async def verify_client_otp(
        self, firma_slug: str, cedula: str, code: str, peer: str = "unknown",
    ) -> User:
        try:
            firma = await self.resolve_firma(firma_slug)
        except UnauthorizedException:
            raise self._invalid_otp()
        await AuthRateLimiter(self.session, firma.id).check(
            "otp-verify", UserRepository.normalize_cedula(cedula), peer, settings.AUTH_VERIFY_LIMIT)
        if not await FirmaRepository(self.session).lock_active(firma.id):
            raise self._invalid_otp()
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
            user.id, self.CLIENT_LOGIN_PURPOSE, lock=True,
        )
        now = datetime.now(timezone.utc)
        if not challenge or now >= challenge.expires_at:
            if challenge:
                await repo.stage_revoke(user.id, self.CLIENT_LOGIN_PURPOSE)
                await self.session.commit()
            raise self._invalid_otp()

        challenge.attempts += 1
        valid_code = code.isdigit() and hmac.compare_digest(
            challenge.code_hash, self._hash_code(code)
        )
        if challenge.attempts > settings.OTP_MAX_ATTEMPTS or not valid_code:
            if challenge.attempts >= settings.OTP_MAX_ATTEMPTS:
                await repo.stage_revoke(user.id, self.CLIENT_LOGIN_PURPOSE)
            await self.session.commit()
            raise self._invalid_otp()

        challenge.consumed_at = now
        await repo.stage_revoke(user.id, self.CLIENT_LOGIN_PURPOSE)
        await self.session.commit()
        return user

    async def issue_password_reset(self, firma_slug: str, email: str, peer: str):
        try:
            firma = await self.resolve_firma(firma_slug)
        except UnauthorizedException:
            return None
        await AuthRateLimiter(self.session, firma.id).check(
            "password-request", email.strip().lower(), peer, settings.AUTH_RECOVERY_REQUEST_LIMIT)
        if not await FirmaRepository(self.session).lock_active(firma.id):
            return None
        user = await UserRepository(self.session, firma.id).get_office_by_email(email)
        if not user or not user.hashed_password:
            await self.session.rollback()
            return None
        repo = AuthChallengeRepository(self.session, firma.id)
        await repo.stage_revoke(user.id, self.PASSWORD_RESET_PURPOSE)
        token = secrets.token_urlsafe(32)
        challenge = await repo.stage_create(user.id, self.PASSWORD_RESET_PURPOSE,
            self._hash_code(token), datetime.now(timezone.utc)
            + timedelta(minutes=settings.PASSWORD_RESET_TTL_MINUTES), None)
        await self.session.commit()
        fragment = urlencode({"challenge": str(challenge.id), "token": token})
        link = f"{settings.FRONTEND_URL}/recuperar-acceso?{urlencode({'firma': firma.subdominio})}#{fragment}"
        return user.email, link

    async def reset_password(self, payload, peer: str) -> str:
        invalid = DomainException(detail="Enlace inválido o vencido")
        try:
            firma = await self.resolve_firma(payload.firma_slug)
        except UnauthorizedException:
            raise invalid
        await AuthRateLimiter(self.session, firma.id).check(
            "password-confirm", str(payload.challenge_id), peer, settings.AUTH_VERIFY_LIMIT)
        if not await FirmaRepository(self.session).lock_active(firma.id):
            raise invalid
        repo = AuthChallengeRepository(self.session, firma.id)
        challenge = await repo.get_for_update(payload.challenge_id, self.PASSWORD_RESET_PURPOSE)
        if not challenge or challenge.consumed_at:
            raise invalid
        now = datetime.now(timezone.utc)
        challenge.attempts += 1
        if (challenge.expires_at <= now or challenge.attempts > settings.OTP_MAX_ATTEMPTS
                or not hmac.compare_digest(challenge.code_hash, self._hash_code(payload.token))):
            if challenge.expires_at <= now or challenge.attempts >= settings.OTP_MAX_ATTEMPTS:
                await repo.stage_revoke(challenge.user_id, self.PASSWORD_RESET_PURPOSE)
            await self.session.commit()
            raise invalid
        user = await UserRepository(self.session, firma.id).get_office_member(challenge.user_id)
        if not user or not user.is_active or not user.hashed_password:
            raise invalid
        user.hashed_password = await run_in_threadpool(get_password_hash, payload.password)
        user.updated_at = datetime.now(timezone.utc)
        challenge.consumed_at = now
        await repo.stage_revoke(user.id, self.PASSWORD_RESET_PURPOSE)
        await repo.stage_revoke_invitations(user.id)
        await self.session.commit()
        return user.email

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
