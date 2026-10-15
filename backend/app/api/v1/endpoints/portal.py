from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import require_roles
from app.models.user import User
from app.repositories.asunto_repository import AsuntoRepository
from app.schemas.portal import AsuntoPortalResponse


router = APIRouter()


@router.get("/asuntos", response_model=list[AsuntoPortalResponse])
async def list_portal_asuntos(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("cliente")),
):
    """Consulta los expedientes propios con sus avances autorizados."""
    asuntos = await AsuntoRepository(db, current_user.firma_id).get_by_portal_user_id(
        current_user.id, solo_publicas=True
    )
    return [AsuntoPortalResponse.from_asunto(asunto) for asunto in asuntos]
