import uuid
from collections.abc import Callable

from fastapi import Depends
from fastapi.security import APIKeyCookie
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.security import decode_access_token
from app.models.user import User
from app.repositories.user_repository import UserRepository


access_token_cookie = APIKeyCookie(name="access_token", auto_error=False)


async def get_current_user(
    access_token: str | None = Depends(access_token_cookie),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not access_token:
        raise UnauthorizedException(detail="Debes iniciar sesión")

    payload = decode_access_token(access_token)
    if not payload or not payload.get("sub") or not payload.get("firma_id"):
        raise UnauthorizedException(detail="Sesión inválida o expirada")

    try:
        user_id = uuid.UUID(payload["sub"])
        firma_id = uuid.UUID(payload["firma_id"])
    except (TypeError, ValueError):
        raise UnauthorizedException(detail="Sesión inválida o expirada")

    user = await UserRepository(db, firma_id).get_by_id(user_id)
    if not user or user.rol != payload.get("rol"):
        raise UnauthorizedException(detail="Sesión inválida o expirada")
    return user


def require_roles(*allowed_roles: str) -> Callable:
    async def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.rol not in allowed_roles:
            raise ForbiddenException(detail="No tienes permisos para realizar esta acción")
        return current_user

    return dependency


require_office_user = require_roles("administrador", "abogado", "auxiliar")
require_admin_user = require_roles("administrador")
