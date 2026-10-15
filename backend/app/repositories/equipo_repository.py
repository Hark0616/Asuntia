import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import raiseload

from app.models.asunto import Asunto
from app.models.cliente import Cliente
from app.models.tarea import Tarea
from app.models.user import User
from app.repositories.base import BaseRepository


class EquipoRepository(BaseRepository[User]):
    """Proyección y transferencia del trabajo activo; nunca modifica su historia."""

    def __init__(self, session, firma_id: uuid.UUID):
        super().__init__(User, session, firma_id)

    async def workload_counts(self) -> dict[uuid.UUID, dict[str, int]]:
        counts: dict[uuid.UUID, dict[str, int]] = {}
        for model, owner, key in (
            (Cliente, Cliente.responsable_id, "clientes"),
            (Asunto, Asunto.abogado_id, "asuntos"),
            (Tarea, Tarea.responsable_id, "tareas_pendientes"),
        ):
            stmt = select(owner, func.count(model.id)).where(
                model.firma_id == self.firma_id, model.is_active.is_(True))
            if model is Tarea:
                stmt = stmt.join(Asunto, Asunto.id == Tarea.asunto_id).where(
                    Asunto.firma_id == self.firma_id, Asunto.is_active.is_(True),
                    Tarea.estado.in_(("pendiente", "en_progreso")))
            for user_id, count in (await self.session.execute(stmt.group_by(owner))).all():
                counts.setdefault(user_id, {})[key] = count
        result = await self.session.execute(
            select(Tarea.responsable_id, func.count(Tarea.id)).join(Asunto)
            .where(Tarea.firma_id == self.firma_id, Tarea.is_active.is_(True),
                   Asunto.firma_id == self.firma_id, Asunto.is_active.is_(True),
                   Tarea.estado.in_(("pendiente", "en_progreso")),
                   Asunto.abogado_id.is_distinct_from(Tarea.responsable_id))
            .group_by(Tarea.responsable_id)
        )
        for user_id, count in result.all():
            counts.setdefault(user_id, {})["tareas_fuera_de_asuntos"] = count
        return counts

    async def get_work_for_transfer(self, source_id: uuid.UUID, *, all_work: bool):
        # El servicio ya tomó el bloqueo de firma. El orden firma -> asunto -> tarea
        # coincide con apertura, asignación y avance de guía.
        cases = list((await self.session.scalars(
            select(Asunto).options(raiseload("*")).where(Asunto.firma_id == self.firma_id,
                Asunto.is_active.is_(True), Asunto.abogado_id == source_id)
            .order_by(Asunto.id).with_for_update(of=Asunto)
        )).all()) if all_work else []
        case_ids = [case.id for case in cases]
        task_filter = (or_(Tarea.responsable_id == source_id,
                          (Tarea.asunto_id.in_(case_ids)) & (Tarea.tipo == "completar_paso"))
                       if all_work else
                       (Tarea.responsable_id == source_id)
                       & Asunto.abogado_id.is_distinct_from(source_id))
        tasks = (await self.session.execute(
            select(Tarea, Asunto.abogado_id).options(raiseload("*")).join(Asunto)
            .where(Tarea.firma_id == self.firma_id, Tarea.is_active.is_(True),
                Asunto.firma_id == self.firma_id, Asunto.is_active.is_(True),
                Tarea.estado.in_(("pendiente", "en_progreso")), task_filter)
            .order_by(Tarea.id).with_for_update(of=Tarea)
        )).all()
        clients = list((await self.session.scalars(
            select(Cliente).options(raiseload("*")).where(Cliente.firma_id == self.firma_id,
                Cliente.is_active.is_(True), Cliente.responsable_id == source_id)
            .order_by(Cliente.id).with_for_update(of=Cliente)
        )).all()) if all_work else []
        return cases, clients, tasks

    def stage_transfer(self, cases, clients, tasks, target_id: uuid.UUID) -> None:
        for case in cases:
            case.abogado_id = target_id
        for client in clients:
            client.responsable_id = target_id
        for task, _ in tasks:
            task.responsable_id = target_id
