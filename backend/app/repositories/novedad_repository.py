import uuid
from typing import Any, List
from sqlalchemy import select
from app.models.novedad import Novedad
from app.repositories.base import BaseRepository

class NovedadRepository(BaseRepository[Novedad]):
    def __init__(self, session, firma_id: uuid.UUID):
        super().__init__(Novedad, session, firma_id)

    async def stage_create(
        self,
        data: dict[str, Any],
        created_by_id: uuid.UUID,
    ) -> Novedad:
        novedad = Novedad(
            **data,
            firma_id=self.firma_id,
            created_by_id=created_by_id,
        )
        self.session.add(novedad)
        await self.session.flush()
        return novedad

    async def get_by_asunto_id(self, asunto_id: uuid.UUID, solo_publicas: bool = False) -> List[Novedad]:
        stmt = (
            select(Novedad)
            .where(Novedad.asunto_id == asunto_id)
            .where(Novedad.firma_id == self.firma_id)
            .where(Novedad.is_active == True)
        )
        if solo_publicas:
            stmt = stmt.where(Novedad.publicado_al_cliente == True)
            
        stmt = stmt.order_by(Novedad.created_at.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
