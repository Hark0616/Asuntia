import uuid
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import selectinload, joinedload
from app.models.asunto import Asunto
from app.repositories.base import BaseRepository

class AsuntoRepository(BaseRepository[Asunto]):
    def __init__(self, session, firma_id: uuid.UUID):
        super().__init__(Asunto, session, firma_id)

    async def list(self, skip: int = 0, limit: int = 100) -> List[Asunto]:
        stmt = (
            select(Asunto)
            .options(
                joinedload(Asunto.cliente),
                joinedload(Asunto.estado),
                selectinload(Asunto.novedades)
            )
            .where(Asunto.firma_id == self.firma_id)
            .where(Asunto.is_active == True)
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def get_by_radicado(self, radicado: str) -> Optional[Asunto]:
        stmt = (
            select(Asunto)
            .options(
                joinedload(Asunto.cliente),
                joinedload(Asunto.estado),
                selectinload(Asunto.novedades)
            )
            .where(Asunto.radicado == radicado)
            .where(Asunto.firma_id == self.firma_id)
            .where(Asunto.is_active == True)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_by_cliente_id(self, cliente_id: uuid.UUID) -> List[Asunto]:
        stmt = (
            select(Asunto)
            .options(
                joinedload(Asunto.cliente),
                joinedload(Asunto.estado),
                selectinload(Asunto.novedades)
            )
            .where(Asunto.cliente_id == cliente_id)
            .where(Asunto.firma_id == self.firma_id)
            .where(Asunto.is_active == True)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())
