import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DomainException
from app.repositories.cita_repository import CitaRepository
from app.repositories.tarea_repository import TareaRepository
from app.schemas.tarea import AgendaItemResponse, AgendaResponse


class AgendaService:
    """Reúne fechas existentes sin crear otra fuente de captura."""

    def __init__(self, session: AsyncSession, firma_id: uuid.UUID):
        self.tareas = TareaRepository(session, firma_id)
        self.citas = CitaRepository(session, firma_id)

    async def list(self, user_id: uuid.UUID, desde: datetime | None,
                   hasta: datetime | None, *, include_team: bool, limit: int,
                   restrict_cases_to_responsable: bool = False):
        now = datetime.now(timezone.utc)
        desde = desde or now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=7)
        hasta = hasta or desde + timedelta(days=37)
        if hasta <= desde or hasta - desde > timedelta(days=92):
            raise DomainException(detail="Consulta un intervalo de hasta 92 días")
        tareas = await self.tareas.scheduled_tasks(
            user_id, desde, hasta, include_team=include_team,
            restrict_cases_to_responsable=restrict_cases_to_responsable)
        citas = await self.citas.scheduled(user_id, desde, hasta, include_team=include_team,
                                          restrict_cases=restrict_cases_to_responsable)
        items = [AgendaItemResponse(
            id=f"tarea:{tarea.id}", origen="tarea", titulo=tarea.titulo,
            fecha=tarea.vence_en, asunto=tarea.asunto, responsable=tarea.responsable,
        ) for tarea in tareas]
        for cita in citas:
            items.append(AgendaItemResponse(
                id=f"cita:{cita.id}", origen="cita", titulo=cita.titulo,
                fecha=cita.inicio, fin=cita.fin, zona_horaria=cita.zona_horaria,
                cita_id=cita.id, asunto=cita.asunto, responsable=cita.responsable,
            ))
        items.sort(key=lambda item: (item.fecha, item.id))
        return AgendaResponse(items=items[:limit], total=len(items))
