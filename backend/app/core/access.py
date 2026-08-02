from app.models.asunto import Asunto
from app.models.user import User


def can_access_asunto(user: User, asunto: Asunto) -> bool:
    if user.rol == "cliente":
        return asunto.cliente.portal_user_id == user.id
    if user.rol == "abogado":
        return asunto.abogado_id == user.id
    return user.rol in {"administrador", "auxiliar"}
