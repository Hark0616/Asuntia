import uuid

from sqlalchemy import select

from app.models.estado import EstadoProcesal
from app.repositories.base import BaseRepository


class EstadoRepository(BaseRepository[EstadoProcesal]):
    def __init__(self, session, firma_id: uuid.UUID):
        super().__init__(EstadoProcesal, session, firma_id)

    async def list_ordered(self) -> list[EstadoProcesal]:
        stmt = (
            select(EstadoProcesal)
            .where(EstadoProcesal.firma_id == self.firma_id)
            .where(EstadoProcesal.is_active == True)
            .order_by(EstadoProcesal.orden.asc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
