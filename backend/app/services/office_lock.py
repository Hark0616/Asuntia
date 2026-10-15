import uuid

from app.core.exceptions import UnauthorizedException
from app.repositories.firma_repository import FirmaRepository
from app.repositories.user_repository import UserRepository


async def lock_office_actor(session, firma_id: uuid.UUID, user_id: uuid.UUID, role: str):
    """Firma antes de expediente/tarea: evita asignaciones durante una baja."""
    if not await FirmaRepository(session).lock_active(firma_id):
        raise UnauthorizedException(detail="Sesión inválida o expirada")
    user = await UserRepository(session, firma_id).get_office_member(user_id)
    if not user or not user.is_active or user.rol != role:
        raise UnauthorizedException(detail="Sesión inválida o expirada")
    return user
