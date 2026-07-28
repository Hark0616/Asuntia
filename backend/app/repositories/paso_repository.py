import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.models.asunto import Asunto
from app.models.asunto_paso import AsuntoPaso
from app.repositories.base import BaseRepository


class PasoRepository(BaseRepository[AsuntoPaso]):
    def __init__(self, session, firma_id: uuid.UUID):
        super().__init__(AsuntoPaso, session, firma_id)

    async def get_current_for_update(self, asunto_id: uuid.UUID) -> AsuntoPaso | None:
        stmt = (
            select(AsuntoPaso)
            .where(AsuntoPaso.asunto_id == asunto_id)
            .where(AsuntoPaso.firma_id == self.firma_id)
            .where(AsuntoPaso.is_active == True)
            .where(AsuntoPaso.estado == "activo")
            .with_for_update()
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_by_order(
        self, asunto_id: uuid.UUID, order: int
    ) -> AsuntoPaso | None:
        stmt = (
            select(AsuntoPaso)
            .where(AsuntoPaso.asunto_id == asunto_id)
            .where(AsuntoPaso.firma_id == self.firma_id)
            .where(AsuntoPaso.is_active == True)
            .where(AsuntoPaso.orden == order)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def complete_and_advance(
        self,
        asunto: Asunto,
        current: AsuntoPaso,
        next_step: AsuntoPaso | None,
        data: dict,
        user_id: uuid.UUID,
    ) -> Asunto:
        current.estado = "completado"
        current.datos = data
        current.completed_at = datetime.now(timezone.utc)
        current.completed_by_id = user_id

        if next_step:
            next_step.estado = "activo"
            asunto.paso_actual = next_step.orden
            asunto.etapa_actual = f"Paso {next_step.orden} de 5: {next_step.titulo}"
            asunto.siguiente_paso = next_step.descripcion
            self.session.add(next_step)
        else:
            asunto.flujo_estado = "completado"
            asunto.etapa_actual = "Flujo inicial completado"
            asunto.siguiente_paso = "Continuar con el seguimiento jurídico del expediente"

        self.session.add(current)
        self.session.add(asunto)
        await self.session.commit()
        return await self._reload_asunto(asunto.id)

    async def _reload_asunto(self, asunto_id: uuid.UUID) -> Asunto:
        from app.repositories.asunto_repository import AsuntoRepository

        asunto = await AsuntoRepository(
            self.session, self.firma_id
        ).get_by_id(asunto_id)
        if asunto is None:
            raise RuntimeError("El asunto actualizado no pudo recargarse")
        return asunto
