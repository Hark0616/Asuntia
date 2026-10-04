import uuid
from datetime import datetime, time, timedelta, timezone
from typing import Optional

from sqlalchemy import case, func, or_, select, update
from sqlalchemy.orm import joinedload

from app.models.asunto import Asunto
from app.models.asunto_paso import AsuntoPaso
from app.models.tarea import (
    Tarea,
    TareaEstado,
    TareaPrioridad,
    TareaTipo,
)
from app.repositories.base import BaseRepository


class TareaRepository(BaseRepository[Tarea]):
    def __init__(self, session, firma_id: uuid.UUID):
        super().__init__(Tarea, session, firma_id)

    @staticmethod
    def _load_options():
        return (
            joinedload(Tarea.asunto).joinedload(Asunto.cliente),
            joinedload(Tarea.responsable),
            joinedload(Tarea.asunto_paso),
        )

    async def list_for_responsable(
        self,
        responsable_id: Optional[uuid.UUID],
        *,
        include_team: bool = False,
        limit: int = 50,
        restrict_cases_to_responsable: bool = False,
    ) -> list[Tarea]:
        now = datetime.now(timezone.utc)
        tomorrow = datetime.combine(
            now.date() + timedelta(days=1), time.min, tzinfo=timezone.utc
        )
        due_bucket = case(
            (Tarea.vence_en < now, 0),
            (Tarea.vence_en < tomorrow, 1),
            (Tarea.vence_en.is_not(None), 2),
            else_=3,
        )
        priority_bucket = case(
            (Tarea.prioridad == TareaPrioridad.URGENTE.value, 0),
            (Tarea.prioridad == TareaPrioridad.ALTA.value, 1),
            (Tarea.prioridad == TareaPrioridad.NORMAL.value, 2),
            else_=3,
        )
        stmt = (
            select(Tarea)
            .join(Tarea.asunto)
            .options(*self._load_options())
            .where(Tarea.firma_id == self.firma_id)
            .where(Tarea.is_active == True)
            .where(Tarea.estado.in_(
                [TareaEstado.PENDIENTE.value, TareaEstado.EN_PROGRESO.value]
            ))
            .where(Asunto.firma_id == self.firma_id)
            .where(Asunto.is_active == True)
            .order_by(
                due_bucket,
                priority_bucket,
                Tarea.vence_en.asc().nullslast(),
                Tarea.created_at.asc(),
                Tarea.id.asc(),
            )
            .limit(limit)
        )
        if not include_team:
            stmt = stmt.where(Tarea.responsable_id == responsable_id)
        if restrict_cases_to_responsable:
            stmt = stmt.where(Asunto.abogado_id == responsable_id)

        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def count_for_responsable(
        self,
        responsable_id: Optional[uuid.UUID],
        *,
        include_team: bool = False,
        restrict_cases_to_responsable: bool = False,
    ) -> int:
        stmt = (
            select(func.count(Tarea.id))
            .join(Tarea.asunto)
            .where(Tarea.firma_id == self.firma_id)
            .where(Tarea.is_active == True)
            .where(Tarea.estado.in_(
                [TareaEstado.PENDIENTE.value, TareaEstado.EN_PROGRESO.value]
            ))
            .where(Asunto.firma_id == self.firma_id)
            .where(Asunto.is_active == True)
        )
        if not include_team:
            stmt = stmt.where(Tarea.responsable_id == responsable_id)
        if restrict_cases_to_responsable:
            stmt = stmt.where(Asunto.abogado_id == responsable_id)

        result = await self.session.execute(stmt)
        return int(result.scalar_one())

    async def get_detail(self, tarea_id: uuid.UUID, *, lock: bool = False) -> Tarea | None:
        stmt = (select(Tarea).options(*self._load_options())
                .join(Tarea.asunto)
                .where(Tarea.id == tarea_id)
                .where(Tarea.firma_id == self.firma_id)
                .where(Tarea.is_active == True)
                .where(Asunto.firma_id == self.firma_id)
                .where(Asunto.is_active == True)
                .execution_options(populate_existing=True))
        if lock:
            stmt = stmt.with_for_update(of=Tarea)
        result = await self.session.execute(stmt)
        return result.scalars().unique().first()

    async def list_by_asunto(self, asunto_id: uuid.UUID) -> list[Tarea]:
        result = await self.session.execute(
            select(Tarea).options(*self._load_options())
            .where(Tarea.asunto_id == asunto_id)
            .where(Tarea.firma_id == self.firma_id)
            .where(Tarea.is_active == True)
            .order_by(Tarea.created_at.desc(), Tarea.id.asc())
        )
        return list(result.scalars().unique().all())

    async def scheduled_tasks(self, user_id: uuid.UUID, desde: datetime, hasta: datetime,
                              *, include_team: bool = False,
                              restrict_cases_to_responsable: bool = False) -> list[Tarea]:
        stmt = (select(Tarea).options(*self._load_options()).join(Tarea.asunto)
                .where(Tarea.firma_id == self.firma_id)
                .where(Tarea.is_active == True)
                .where(Asunto.firma_id == self.firma_id)
                .where(Asunto.is_active == True)
                .where(Tarea.estado.in_(["pendiente", "en_progreso"]))
                .where(Tarea.vence_en >= desde).where(Tarea.vence_en < hasta))
        if not include_team:
            stmt = stmt.where(Tarea.responsable_id == user_id)
        if restrict_cases_to_responsable:
            stmt = stmt.where(Asunto.abogado_id == user_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    def stage_manual(self, data: dict, actor_id: uuid.UUID) -> Tarea:
        tarea = Tarea(**data, firma_id=self.firma_id,
                      codigo=f"manual:{uuid.uuid4()}", tipo=TareaTipo.TAREA_INTERNA.value,
                      estado=TareaEstado.PENDIENTE.value, solicitante_id=actor_id,
                      created_by_id=actor_id)
        self.session.add(tarea)
        return tarea

    def stage_update(self, tarea: Tarea, data: dict, actor_id: uuid.UUID) -> None:
        for field, value in data.items():
            setattr(tarea, field, value)
        if data.get("estado") == TareaEstado.COMPLETADA.value:
            tarea.completed_at = datetime.now(timezone.utc)
            tarea.completed_by_id = actor_id
        elif data.get("estado") in {TareaEstado.PENDIENTE.value, TareaEstado.EN_PROGRESO.value}:
            tarea.completed_at = None
            tarea.completed_by_id = None
        if data.get("estado") == TareaEstado.EN_PROGRESO.value and not tarea.started_at:
            tarea.started_at = datetime.now(timezone.utc)
        self.session.add(tarea)

    async def get_open_for_step_for_update(
        self, asunto_id: uuid.UUID, asunto_paso_id: uuid.UUID
    ) -> Tarea | None:
        stmt = (
            select(Tarea)
            .where(Tarea.asunto_id == asunto_id)
            .where(Tarea.asunto_paso_id == asunto_paso_id)
            .where(Tarea.firma_id == self.firma_id)
            .where(Tarea.is_active == True)
            .where(Tarea.estado.in_(
                [TareaEstado.PENDIENTE.value, TareaEstado.EN_PROGRESO.value]
            ))
            .with_for_update(of=Tarea)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    def stage_for_step(
        self,
        asunto: Asunto,
        paso: AsuntoPaso,
        responsable_id: uuid.UUID,
        solicitante_id: uuid.UUID,
    ) -> Tarea:
        tarea = Tarea(
            firma_id=self.firma_id,
            asunto_id=asunto.id,
            asunto_paso_id=paso.id,
            codigo=f"paso:{paso.codigo}",
            tipo=TareaTipo.COMPLETAR_PASO.value,
            titulo=f"Completar {paso.titulo.lower()}",
            instruccion=paso.descripcion,
            estado=TareaEstado.PENDIENTE.value,
            prioridad=TareaPrioridad.NORMAL.value,
            responsable_id=responsable_id,
            solicitante_id=solicitante_id,
            created_by_id=solicitante_id,
        )
        self.session.add(tarea)
        return tarea

    def stage_complete_from_workflow(
        self,
        tarea: Tarea,
        actor_id: uuid.UUID,
        resultado: str,
    ) -> None:
        tarea.estado = TareaEstado.COMPLETADA.value
        tarea.completed_at = datetime.now(timezone.utc)
        tarea.completed_by_id = actor_id
        tarea.resultado = resultado
        self.session.add(tarea)

    async def reassign_open_for_asunto(
        self,
        asunto_id: uuid.UUID,
        responsable_id: uuid.UUID,
        previous_lawyer_id: uuid.UUID | None = None,
    ) -> int:
        result = await self.session.execute(
            update(Tarea)
            .where(Tarea.asunto_id == asunto_id)
            .where(Tarea.firma_id == self.firma_id)
            .where(Tarea.is_active == True)
            .where(or_(Tarea.tipo == TareaTipo.COMPLETAR_PASO.value,
                       Tarea.responsable_id == previous_lawyer_id) if previous_lawyer_id
                   else Tarea.tipo == TareaTipo.COMPLETAR_PASO.value)
            .where(
                Tarea.estado.in_(
                    [
                        TareaEstado.PENDIENTE.value,
                        TareaEstado.EN_PROGRESO.value,
                    ]
                )
            )
            .values(responsable_id=responsable_id)
        )
        return result.rowcount or 0
