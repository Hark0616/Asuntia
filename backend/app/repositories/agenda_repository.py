import uuid
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.models.asunto import Asunto
from app.models.asunto_paso import AsuntoPaso
from app.repositories.base import BaseRepository


class AgendaRepository(BaseRepository[AsuntoPaso]):
    """Proyecta fechas de audiencia ya capturadas, sin mantener otra agenda en BD."""

    def __init__(self, session, firma_id: uuid.UUID):
        super().__init__(AsuntoPaso, session, firma_id)

    async def scheduled_hearings(self, user_id: uuid.UUID, desde: datetime, hasta: datetime,
                                 *, include_team: bool = False):
        stmt = (select(AsuntoPaso)
                .join(AsuntoPaso.asunto)
                .options(joinedload(AsuntoPaso.asunto).joinedload(Asunto.cliente),
                         joinedload(AsuntoPaso.asunto).joinedload(Asunto.abogado))
                .where(AsuntoPaso.firma_id == self.firma_id)
                .where(AsuntoPaso.is_active == True)
                .where(AsuntoPaso.codigo == "agendar_audiencia")
                .where(AsuntoPaso.datos["fecha_hora"].astext.is_not(None))
                # Ventana amplia por fecha ISO; el servicio valida el instante
                # exacto tras aplicar el huso explícito o el legado de Bogotá.
                .where(AsuntoPaso.datos["fecha_hora"].astext >= (desde - timedelta(days=2)).date().isoformat())
                .where(AsuntoPaso.datos["fecha_hora"].astext < (hasta + timedelta(days=2)).date().isoformat())
                .where(Asunto.firma_id == self.firma_id)
                .where(Asunto.is_active == True))
        if not include_team:
            stmt = stmt.where(Asunto.abogado_id == user_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())
