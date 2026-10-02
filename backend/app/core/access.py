from app.models.asunto import Asunto
from app.models.user import User
from app.core.exceptions import ForbiddenException


def can_access_asunto(user: User, asunto: Asunto) -> bool:
    if user.rol == "cliente":
        return (
            asunto.cliente.is_active
            and asunto.cliente.firma_id == user.firma_id
            and asunto.cliente.portal_user_id == user.id
        )
    if user.rol == "abogado":
        return asunto.abogado_id == user.id
    return user.rol in {"administrador", "auxiliar"}


def require_publication_permission(user: User) -> None:
    """La captura auxiliar permanece interna hasta una autorización profesional."""
    if user.rol not in {"administrador", "abogado"}:
        raise ForbiddenException(detail="Solo un abogado o administrador puede publicar al cliente")
