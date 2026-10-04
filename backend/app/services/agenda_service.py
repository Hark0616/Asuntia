import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DomainException
from app.repositories.agenda_repository import AgendaRepository
from app.repositories.tarea_repository import TareaRepository
from app.schemas.tarea import AgendaItemResponse, AgendaResponse


class AgendaService:
    """Reúne fechas existentes sin crear otra fuente de captura."""

    def __init__(self, session: AsyncSession, firma_id: uuid.UUID):
        self.tareas = TareaRepository(session, firma_id)
        self.audiencias = AgendaRepository(session, firma_id)

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
        pasos = await self.audiencias.scheduled_hearings(user_id, desde, hasta, include_team=include_team)
        items = [AgendaItemResponse(
            id=f"tarea:{tarea.id}", origen="tarea", titulo=tarea.titulo,
            fecha=tarea.vence_en, asunto=tarea.asunto, responsable=tarea.responsable,
        ) for tarea in tareas]
        for paso in pasos:
            try:
                fecha = datetime.fromisoformat(paso.datos["fecha_hora"])
            except (KeyError, TypeError, ValueError):
                continue
            if fecha.tzinfo is None:
                # Fechas operativas legadas en Colombia (UTC−5, sin horario de verano).
                fecha = fecha.replace(tzinfo=timezone(timedelta(hours=-5)))
            asunto = paso.asunto
            if desde <= fecha < hasta and asunto.abogado and asunto.abogado.is_active:
                items.append(AgendaItemResponse(
                    id=f"audiencia:{paso.id}", origen="audiencia", titulo="Audiencia registrada",
                    fecha=fecha, asunto=asunto, responsable=asunto.abogado,
                ))
        items.sort(key=lambda item: (item.fecha, item.id))
        return AgendaResponse(items=items[:limit], total=len(items))
