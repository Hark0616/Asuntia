import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.core.exceptions import DomainException, NotFoundException, UnauthorizedException
from app.models.cliente import Cliente
from app.models.user import User
from app.repositories.auth_challenge_repository import AuthChallengeRepository
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.user_repository import UserRepository
from app.schemas.cliente import ClienteCreate, ClienteResponse, ClienteUpdate
from app.services.office_lock import lock_office_actor


class ClienteService:
    """Coordina el perfil jurídico y su identidad opcional de portal."""

    def __init__(self, session: AsyncSession, firma_id: uuid.UUID):
        self.session = session
        self.firma_id = firma_id

    async def edit(self, cliente_id: uuid.UUID, payload: ClienteUpdate, actor: User) -> Cliente:
        revision = actor.updated_at
        try:
            current = await lock_office_actor(self.session, self.firma_id, actor.id, actor.rol)
            if current.updated_at != revision:
                raise UnauthorizedException(detail="Sesión inválida o expirada")
            repo = ClienteRepository(self.session, self.firma_id)
            cliente = await repo.get_by_id_for_update(cliente_id)
            if cliente is None:
                raise NotFoundException(detail="Cliente no encontrado")
            if cliente.updated_at != payload.expected_updated_at:
                raise DomainException(detail="El cliente cambió. Recarga sus datos antes de guardar", status_code=409)
            changes = payload.model_dump(exclude_unset=True, exclude={"expected_updated_at"})
            if "email" in changes:
                changes["email"] = str(changes["email"]).lower()
            changes = {field: value for field, value in changes.items() if getattr(cliente, field) != value}
            if not changes:
                return cliente
            if "numero_documento" in changes:
                duplicate = await repo.get_by_document(changes["numero_documento"])
                if duplicate and duplicate.id != cliente.id:
                    raise DomainException(detail="Ya existe un cliente con esa identificación", status_code=409)
            if cliente.portal_user_id:
                users = UserRepository(self.session, self.firma_id)
                identity = await users.get_portal_identity_for_update(cliente.portal_user_id)
                if identity is None:
                    raise DomainException(detail="La identidad del portal requiere revisión", status_code=409)
                revoke = (
                    "email" in changes
                    or ("numero_documento" in changes and repo.normalize_document(changes["numero_documento"])
                        != cliente.numero_documento_normalizado)
                )
                mirror = {("cedula" if key == "numero_documento" else key): value
                          for key, value in changes.items() if key in {"nombre", "email", "numero_documento", "telefono"}}
                if mirror:
                    await users.stage_sync_portal(identity, mirror, revoke=revoke)
                if revoke:
                    await AuthChallengeRepository(self.session, self.firma_id).stage_revoke_all(identity.id)
            repo.stage_edit(cliente, changes)
            await self.session.flush()
            updated = await repo.get_by_id(cliente_id)
            ClienteResponse.model_validate(updated)
            await self.session.commit()
            return updated
        except IntegrityError as error:
            await self.session.rollback()
            if "uq_clientes_firma_documento" in str(error.orig):
                raise DomainException(detail="Ya existe un cliente con esa identificación", status_code=409) from error
            raise
        except Exception:
            await self.session.rollback()
            raise

    async def create(
        self,
        payload: ClienteCreate,
        *,
        created_by_id: uuid.UUID,
        commit: bool,
        responsable_id: uuid.UUID | None = None,
    ) -> Cliente:
        cliente_repo = ClienteRepository(self.session, self.firma_id)
        if await cliente_repo.get_by_document(payload.numero_documento):
            raise DomainException(
                detail="Ya existe un cliente con esa identificación"
            )

        cliente_data = payload.model_dump(exclude={"habilitar_portal"})
        cliente_data["responsable_id"] = responsable_id
        if payload.habilitar_portal:
            portal_user = await UserRepository(
                self.session, self.firma_id
            ).create_pending(
                {
                    "nombre": payload.nombre.strip(),
                    "email": str(payload.email).strip().lower(),
                    "cedula": payload.numero_documento.strip(),
                    "rol": "cliente",
                    "hashed_password": None,
                    "telefono": payload.telefono,
                },
                created_by_id=created_by_id,
            )
            cliente_data["portal_user_id"] = portal_user.id

        cliente = await cliente_repo.create_pending(
            cliente_data,
            created_by_id=created_by_id,
        )
        if commit:
            await self.session.commit()
            await self.session.refresh(cliente)
        return cliente
