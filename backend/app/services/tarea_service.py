import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access import can_access_asunto
from app.core.exceptions import DomainException, ForbiddenException, NotFoundException
from app.models.user import User
from app.repositories.asunto_repository import AsuntoRepository
from app.repositories.tarea_repository import TareaRepository
from app.repositories.user_repository import UserRepository
from app.schemas.tarea import TareaCreate, TareaUpdate


class TareaService:
    """Delega trabajo interno sin duplicar ni cerrar pasos del expediente."""

    def __init__(self, session: AsyncSession, firma_id: uuid.UUID):
        self.session = session
        self.asuntos = AsuntoRepository(session, firma_id)
        self.tareas = TareaRepository(session, firma_id)
        self.users = UserRepository(session, firma_id)

    async def _require_assignee(self, user_id: uuid.UUID, asunto):
        user = await self.users.get_by_id(user_id)
        if not user or user.rol not in {"administrador", "abogado", "auxiliar"}:
            raise NotFoundException(detail="Responsable no encontrado")
        if user.rol == "abogado" and user.id != asunto.abogado_id:
            raise DomainException(detail="El abogado debe ser responsable del asunto para recibir esta tarea")
        return user

    async def create(self, payload: TareaCreate, actor: User):
        asunto = await self.asuntos.get_by_id_for_update(payload.asunto_id)
        if not asunto or not can_access_asunto(actor, asunto):
            raise NotFoundException(detail="Asunto no encontrado")
        if actor.rol not in {"administrador", "abogado"}:
            raise ForbiddenException(detail="Solo el responsable o la administración puede delegar trabajo")
        await self._require_assignee(payload.responsable_id, asunto)
        tarea = self.tareas.stage_manual(payload.model_dump(), actor.id)
        await self.session.commit()
        return await self.tareas.get_detail(tarea.id)

    async def update(self, tarea_id: uuid.UUID, payload: TareaUpdate, actor: User):
        original = await self.tareas.get_detail(tarea_id)
        if original is None:
            raise NotFoundException(detail="Tarea no encontrada")
        asunto = await self.asuntos.get_by_id_for_update(original.asunto_id)
        if not asunto or not can_access_asunto(actor, asunto):
            raise NotFoundException(detail="Tarea no encontrada")
        tarea = await self.tareas.get_detail(tarea_id, lock=True)
        if tarea is None:
            raise NotFoundException(detail="Tarea no encontrada")
        manager = actor.rol == "administrador" or (
            actor.rol == "abogado" and asunto.abogado_id == actor.id
        )
        if not manager and tarea.responsable_id != actor.id:
            raise ForbiddenException(detail="Solo puedes actualizar tu trabajo asignado")
        data = payload.model_dump(exclude_unset=True, exclude={"expected_updated_at"})
        if any(value is None for field, value in data.items() if field != "vence_en"):
            raise DomainException(detail="La tarea contiene campos obligatorios vacíos", status_code=422)
        if not manager and set(data) - {"estado"}:
            raise ForbiddenException(detail="Solo el responsable o la administración puede editar la asignación")
        if tarea.tipo == "completar_paso" and set(data) - {"vence_en", "prioridad"}:
            raise DomainException(detail="Este trabajo se completa desde el paso del expediente", status_code=409)
        if tarea.updated_at != payload.expected_updated_at:
            raise DomainException(detail="La tarea cambió. Recárgala antes de guardar", status_code=409)
        if "responsable_id" in data:
            await self._require_assignee(data["responsable_id"], asunto)
        if tarea.estado in {"completada", "cancelada"} and not manager:
            raise DomainException(detail="Solo el responsable puede reabrir esta tarea", status_code=409)
        if tarea.estado == data.get("estado"):
            data.pop("estado")
        self.tareas.stage_update(tarea, data, actor.id)
        await self.session.commit()
        return await self.tareas.get_detail(tarea.id)
