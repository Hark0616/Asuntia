import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DomainException
from app.models.cliente import Cliente
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.user_repository import UserRepository
from app.schemas.cliente import ClienteCreate


class ClienteService:
    """Coordina el perfil jurídico y su identidad opcional de portal."""

    def __init__(self, session: AsyncSession, firma_id: uuid.UUID):
        self.session = session
        self.firma_id = firma_id

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
