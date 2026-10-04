from typing import Literal
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import require_office_user, require_roles
from app.core.access import can_access_asunto
from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.user import User
from app.repositories.tarea_repository import TareaRepository
from app.schemas.tarea import (AgendaResponse, MiTrabajoResponse,
                              TareaCreate, TareaResponse, TareaUpdate)
from app.repositories.asunto_repository import AsuntoRepository
from app.services.agenda_service import AgendaService
from app.services.tarea_service import TareaService
from pydantic import AwareDatetime


router = APIRouter()


def require_team_scope(user: User, alcance: str) -> bool:
    include_team = alcance == "equipo"
    if include_team and user.rol != "administrador":
        raise ForbiddenException(detail="Solo la administración puede consultar el trabajo de toda la firma")
    return include_team


@router.post("", response_model=TareaResponse, status_code=201)
async def create_task(payload: TareaCreate, db: AsyncSession = Depends(get_db),
                      current_user: User = Depends(require_roles("administrador", "abogado"))):
    return await TareaService(db, current_user.firma_id).create(payload, current_user)


@router.get("/asunto/{asunto_id}", response_model=list[TareaResponse])
async def list_case_tasks(asunto_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                          current_user: User = Depends(require_office_user)):
    asunto = await AsuntoRepository(db, current_user.firma_id).get_by_id(asunto_id)
    if not asunto or not can_access_asunto(current_user, asunto):
        raise NotFoundException(detail="Asunto no encontrado")
    return await TareaRepository(db, current_user.firma_id).list_by_asunto(asunto_id)


@router.patch("/{tarea_id}", response_model=TareaResponse)
async def update_task(tarea_id: uuid.UUID, payload: TareaUpdate,
                      db: AsyncSession = Depends(get_db),
                      current_user: User = Depends(require_office_user)):
    return await TareaService(db, current_user.firma_id).update(tarea_id, payload, current_user)


@router.get("/agenda", response_model=AgendaResponse)
async def get_agenda(alcance: Literal["mio", "equipo"] = "mio",
                     desde: AwareDatetime | None = None, hasta: AwareDatetime | None = None,
                     limit: int = Query(default=100, ge=1, le=100),
                     db: AsyncSession = Depends(get_db),
                     current_user: User = Depends(require_office_user)):
    """Fechas operativas derivadas de tareas y audiencias, sin cálculo de términos."""
    include_team = require_team_scope(current_user, alcance)
    return await AgendaService(db, current_user.firma_id).list(
        current_user.id, desde, hasta, include_team=include_team, limit=limit,
        restrict_cases_to_responsable=current_user.rol == "abogado")


@router.get("/mi-trabajo", response_model=MiTrabajoResponse)
async def get_mi_trabajo(
    alcance: Literal["mio", "equipo"] = Query(default="mio"),
    limit: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_office_user),
):
    """Lista el trabajo abierto del usuario o de la firma cuando administra."""
    include_team = require_team_scope(current_user, alcance)

    repo = TareaRepository(db, current_user.firma_id)
    tareas = await repo.list_for_responsable(
        current_user.id,
        include_team=include_team,
        limit=limit,
        restrict_cases_to_responsable=current_user.rol == "abogado",
    )
    total = await repo.count_for_responsable(
        current_user.id,
        include_team=include_team,
        restrict_cases_to_responsable=current_user.rol == "abogado",
    )
    return {"items": tareas, "total": total}
