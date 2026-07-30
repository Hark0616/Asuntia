import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.models.asunto import Asunto
from app.models.cliente import Cliente
from app.repositories.asunto_repository import AsuntoRepository
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.tarea_repository import TareaRepository
from app.repositories.user_repository import UserRepository


class AsignacionService:
    """Mantiene coherentes los responsables de clientes, asuntos y trabajo abierto."""

    def __init__(self, session: AsyncSession, firma_id: uuid.UUID):
        self.session = session
        self.firma_id = firma_id

    async def _require_responsable(self, responsable_id: uuid.UUID):
        responsable = await UserRepository(
            self.session, self.firma_id
        ).get_case_responsible(responsable_id)
        if responsable is None:
            raise NotFoundException(detail="Responsable no encontrado")
        return responsable

    async def assign_client(
        self,
        cliente_id: uuid.UUID,
        responsable_id: uuid.UUID,
    ) -> Cliente:
        cliente_repo = ClienteRepository(self.session, self.firma_id)
        cliente = await cliente_repo.get_by_id(cliente_id)
        if cliente is None:
            raise NotFoundException(detail="Cliente no encontrado")
        await self._require_responsable(responsable_id)

        cliente_repo.stage_responsible(cliente, responsable_id)
        await self.session.commit()
        updated = await cliente_repo.get_by_id(cliente_id)
        if updated is None:
            raise RuntimeError("El cliente asignado no pudo recargarse")
        return updated

    async def assign_case(
        self,
        asunto_id: uuid.UUID,
        responsable_id: uuid.UUID,
    ) -> Asunto:
        asunto_repo = AsuntoRepository(self.session, self.firma_id)
        asunto = await asunto_repo.get_by_id(asunto_id)
        if asunto is None:
            raise NotFoundException(detail="Asunto no encontrado")
        await self._require_responsable(responsable_id)

        asunto_repo.stage_responsible(asunto, responsable_id)
        await TareaRepository(
            self.session, self.firma_id
        ).reassign_open_for_asunto(asunto_id, responsable_id)
        await self.session.commit()
        updated = await asunto_repo.get_by_id(asunto_id)
        if updated is None:
            raise RuntimeError("El asunto asignado no pudo recargarse")
        return updated
