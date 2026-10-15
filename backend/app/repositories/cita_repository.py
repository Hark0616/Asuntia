import uuid
from datetime import datetime, timezone

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import joinedload

from app.models.asunto import Asunto
from app.models.asunto_paso import AsuntoPaso
from app.models.cita import Cita, CitaCambio
from app.models.cliente import Cliente
from app.models.user import User
from app.repositories.base import BaseRepository


class CitaRepository(BaseRepository[Cita]):
    def __init__(self, session, firma_id: uuid.UUID):
        super().__init__(Cita, session, firma_id)

    def _query(self):
        return (select(Cita).join(Cita.asunto).join(Asunto.cliente).join(Cita.responsable)
                .options(joinedload(Cita.asunto).joinedload(Asunto.cliente), joinedload(Cita.responsable))
                .where(Cita.firma_id == self.firma_id, Cita.is_active.is_(True),
                       Asunto.firma_id == self.firma_id, Asunto.is_active.is_(True),
                       Cliente.firma_id == self.firma_id, Cliente.is_active.is_(True),
                       User.firma_id == self.firma_id)
                .execution_options(populate_existing=True))

    async def get_detail(self, cita_id: uuid.UUID, *, lock=False):
        stmt = self._query().where(Cita.id == cita_id)
        if lock:
            stmt = stmt.with_for_update(of=Cita)
        return (await self.session.execute(stmt)).scalars().unique().first()

    async def by_operation(self, operacion_id: uuid.UUID):
        return (await self.session.execute(self._query().where(Cita.operacion_id == operacion_id))).scalars().unique().first()

    async def referenced_by_guide(self, cita):
        return await self.session.scalar(select(AsuntoPaso.id).where(
            AsuntoPaso.firma_id == self.firma_id, AsuntoPaso.is_active.is_(True),
            AsuntoPaso.asunto_id == cita.asunto_id, AsuntoPaso.datos['cita_id'].astext == str(cita.id),
        ).limit(1)) is not None

    async def by_asunto(self, asunto_id: uuid.UUID):
        return list((await self.session.execute(self._query().where(Cita.asunto_id == asunto_id)
                    .order_by(Cita.inicio, Cita.id))).scalars().unique().all())

    async def pending_for_user(self, user_id: uuid.UUID):
        now = datetime.now(timezone.utc)
        stmt = self._query().where(Cita.estado == "programada", or_(Cita.inicio >= now, Cita.fin > now),
                                  or_(Cita.responsable_id == user_id, Cita.participantes_ids.contains([str(user_id)])))
        return list((await self.session.execute(stmt.order_by(Cita.id).with_for_update(of=Cita))).scalars().unique().all())

    async def scheduled(self, user_id: uuid.UUID, desde: datetime, hasta: datetime,
                        *, include_team=False, restrict_cases=False):
        # Solapamiento de intervalos: también aparecen citas iniciadas el día anterior.
        stmt = self._query().where(Cita.estado == "programada", Cita.inicio < hasta,
                                  or_(Cita.fin > desde, (Cita.fin.is_(None) & (Cita.inicio >= desde))))
        if not include_team:
            stmt = stmt.where(or_(Cita.responsable_id == user_id, Cita.participantes_ids.contains([str(user_id)])))
        if restrict_cases:
            stmt = stmt.where(Asunto.abogado_id == user_id)
        return list((await self.session.execute(stmt)).scalars().unique().all())

    def stage_create(self, data: dict, actor_id: uuid.UUID):
        cita = Cita(**data, firma_id=self.firma_id, created_by_id=actor_id)
        self.session.add(cita)
        return cita

    def stage_change(self, cita: Cita, accion: str, antes: dict | None, despues: dict, actor_id: uuid.UUID):
        self.session.add(CitaCambio(firma_id=self.firma_id, cita_id=cita.id, accion=accion,
                                   datos={"antes": antes, "despues": despues}, created_by_id=actor_id))

    async def history(self, cita_id: uuid.UUID):
        from app.schemas.cita import CitaCambioResponse
        rows = (await self.session.execute(select(CitaCambio, User.nombre).outerjoin(User, and_(
            User.id == CitaCambio.created_by_id, User.firma_id == self.firma_id,
        )).where(
            CitaCambio.firma_id == self.firma_id, CitaCambio.is_active.is_(True), CitaCambio.cita_id == cita_id,
        ).order_by(CitaCambio.created_at, CitaCambio.id))).all()
        return [CitaCambioResponse(**CitaCambioResponse.model_validate(change).model_dump(exclude={'autor'}),
            autor={'id': change.created_by_id, 'nombre': nombre} if nombre else None) for change, nombre in rows]

