from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import require_office_user
from app.core.exceptions import ForbiddenException
from app.models.user import User
from app.repositories.tarea_repository import TareaRepository
from app.schemas.tarea import MiTrabajoResponse


router = APIRouter()


@router.get("/mi-trabajo", response_model=MiTrabajoResponse)
async def get_mi_trabajo(
    alcance: Literal["mio", "equipo"] = Query(default="mio"),
    limit: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_office_user),
):
    """Lista el trabajo abierto del usuario o de la firma cuando administra."""
    include_team = alcance == "equipo"
    if include_team and current_user.rol != "administrador":
        raise ForbiddenException(
            detail="Solo la administración puede consultar el trabajo de toda la firma"
        )

    repo = TareaRepository(db, current_user.firma_id)
    tareas = await repo.list_for_responsable(
        current_user.id,
        include_team=include_team,
        limit=limit,
    )
    total = await repo.count_for_responsable(
        current_user.id,
        include_team=include_team,
    )
    return {"items": tareas, "total": total}
