import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from app.core.exceptions import DomainException, NotFoundException
from app.core.security import get_password_hash
from app.repositories.auth_challenge_repository import AuthChallengeRepository
from app.repositories.equipo_repository import EquipoRepository
from app.repositories.firma_repository import FirmaRepository
from app.repositories.user_repository import UserRepository
from app.schemas.equipo import MiembroEquipoResponse
from app.services.auth_service import AuthService
from app.services.office_lock import lock_office_actor


class EquipoService:
    def __init__(self, session, firma_id: uuid.UUID):
        self.session = session
        self.firma_id = firma_id
        self.users = UserRepository(session, firma_id)
        self.challenges = AuthChallengeRepository(session, firma_id)

    async def list_members(self) -> list[MiembroEquipoResponse]:
        pending = await self.challenges.pending_invitation_users(datetime.now(timezone.utc))
        counts = await EquipoRepository(self.session, self.firma_id).workload_counts()
        return [MiembroEquipoResponse(
            id=user.id, nombre=user.nombre, email=user.email, cedula=user.cedula,
            rol=user.rol, updated_at=user.updated_at,
            estado="activo" if user.is_active else "invitado" if user.id in pending else "inactivo",
            **counts.get(user.id, {}),
        ) for user in await self.users.list_managed_members()]

    async def _member(self, user_id, expected_updated_at):
        user = await self.users.get_office_member(user_id)
        if not user:
            raise NotFoundException(detail="Miembro no encontrado")
        if user.updated_at != expected_updated_at:
            raise DomainException(detail="El miembro cambió. Recarga el equipo antes de guardar", status_code=409)
        return user

    async def _invitation(self, user, actor):
        token = secrets.token_urlsafe(32)
        await self.challenges.stage_revoke_all(user.id)
        challenge = await self.challenges.stage_invitation(
            user.id, AuthService._hash_code(token),
            datetime.now(timezone.utc) + timedelta(hours=24), actor.id)
        # También invalida sesiones anteriores cuando se reincorpora la identidad.
        user.updated_at = datetime.now(timezone.utc)
        await self.session.commit()
        member = next(item for item in await self.list_members() if item.id == user.id)
        firma = await FirmaRepository(self.session).get_by_id(self.firma_id)
        return dict(miembro=member, firma_slug=firma.subdominio,
                    invitacion_id=challenge.id, token=token, expires_at=challenge.expires_at)

    async def invite(self, payload, actor):
        await lock_office_actor(self.session, self.firma_id, actor.id, "administrador")
        if await self.users.find_office_identity(str(payload.email), payload.cedula):
            raise DomainException(detail="El correo o documento ya pertenece al equipo. Reincorpora al miembro existente", status_code=409)
        user = await self.users.create_pending(dict(
            nombre=payload.nombre, email=str(payload.email).lower(), cedula=payload.cedula,
            rol=payload.rol, hashed_password=None, is_active=False), created_by_id=actor.id)
        return await self._invitation(user, actor)

    async def reinvite(self, user_id, payload, actor):
        await lock_office_actor(self.session, self.firma_id, actor.id, "administrador")
        user = await self._member(user_id, payload.expected_updated_at)
        if user.is_active:
            raise DomainException(detail="El miembro ya tiene acceso activo", status_code=409)
        return await self._invitation(user, actor)

    async def _transfer_work(self, user_id, target, *, all_work):
        repo = EquipoRepository(self.session, self.firma_id)
        cases, clients, tasks = await repo.get_work_for_transfer(user_id, all_work=all_work)
        if (cases or clients or tasks) and target is None:
            raise DomainException(detail="Selecciona quién recibirá el trabajo pendiente", status_code=409)
        if target is None:
            return
        case_ids = {case.id for case in cases}
        for task, case_owner in tasks:
            future_owner = target.id if task.asunto_id in case_ids else case_owner
            if target.rol == "abogado" and future_owner != target.id:
                raise DomainException(
                    detail="Hay tareas de otros asuntos. Selecciona un administrador para recibirlas",
                    status_code=409)
        repo.stage_transfer(cases, clients, tasks, target.id)

    async def change(self, user_id, payload, actor, *, deactivate=False):
        await lock_office_actor(self.session, self.firma_id, actor.id, "administrador")
        user = await self._member(user_id, payload.expected_updated_at)
        new_role = user.rol if deactivate else payload.rol
        if user.rol == "administrador" and user.is_active and (deactivate or new_role != "administrador"):
            if await self.users.count_administrators() <= 1:
                raise DomainException(detail="La firma debe conservar un administrador activo", status_code=409)
        if actor.id == user.id:
            raise DomainException(detail="Otro administrador debe modificar tu acceso", status_code=409)
        if not deactivate and new_role == user.rol:
            raise DomainException(detail="El miembro ya tiene ese rol", status_code=409)
        target = None
        if payload.reasignar_a_id:
            target = await self.users.get_case_responsible(payload.reasignar_a_id)
            if not target or target.id == user.id:
                raise NotFoundException(detail="Responsable de destino no encontrado")
        if deactivate or new_role == "auxiliar":
            await self._transfer_work(user.id, target, all_work=True)
        elif new_role == "abogado":
            await self._transfer_work(user.id, target, all_work=False)
        user.rol = new_role
        if deactivate:
            user.is_active = False
        user.updated_at = datetime.now(timezone.utc)
        await self.challenges.stage_revoke_all(user.id)
        await self.session.commit()
        return next(item for item in await self.list_members() if item.id == user.id)

    async def activate(self, payload):
        # Mismo orden de bloqueos que la administración. No depende de una cookie.
        if not await FirmaRepository(self.session).lock_active(self.firma_id):
            raise DomainException(detail="Invitación inválida o vencida")
        challenge = await self.challenges.get_invitation_for_update(payload.invitacion_id)
        if (not challenge or challenge.consumed_at
                or challenge.expires_at <= datetime.now(timezone.utc)
                or not hmac.compare_digest(challenge.code_hash, AuthService._hash_code(payload.token))):
            raise DomainException(detail="Invitación inválida o vencida")
        user = await self.users.get_office_member(challenge.user_id)
        if not user or user.is_active:
            raise DomainException(detail="Invitación inválida o vencida")
        user.hashed_password = get_password_hash(payload.password)
        user.is_active = True
        user.updated_at = datetime.now(timezone.utc)
        challenge.consumed_at = datetime.now(timezone.utc)
        challenge.is_active = False
        await self.challenges.stage_revoke_all(user.id)
        await self.session.commit()
