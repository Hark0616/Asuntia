import uuid
from datetime import datetime, time, timedelta, timezone
from typing import Optional

from sqlalchemy import case, func, select
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

        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def count_for_responsable(
        self,
        responsable_id: Optional[uuid.UUID],
        *,
        include_team: bool = False,
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

        result = await self.session.execute(stmt)
        return int(result.scalar_one())

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
