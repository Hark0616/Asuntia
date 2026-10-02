import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_current_user, require_office_user, require_roles
from app.core.access import can_access_asunto, require_publication_permission
from app.core.db import get_db
from app.schemas.novedad import NovedadCreate, NovedadResponse
from app.schemas.portal import NovedadPortalResponse
from app.repositories.novedad_repository import NovedadRepository
from app.repositories.asunto_repository import AsuntoRepository
from app.core.exceptions import NotFoundException
from app.models.user import User

router = APIRouter()

@router.get("/asunto/{asunto_id}", response_model=List[NovedadResponse | NovedadPortalResponse])
async def list_novedades(
    asunto_id: uuid.UUID,
    solo_publicas: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene el historial de novedades de un asunto.
    """
    asunto = await AsuntoRepository(db, current_user.firma_id).get_by_id(asunto_id)
    if not asunto or not can_access_asunto(current_user, asunto):
        raise NotFoundException(detail="Asunto no encontrado")

    repo = NovedadRepository(db, current_user.firma_id)
    if current_user.rol == "cliente":
        solo_publicas = True
    novedades = await repo.get_by_asunto_id(asunto_id, solo_publicas=solo_publicas)
    if current_user.rol == "cliente":
        return [NovedadPortalResponse.model_validate(item) for item in novedades]
    return novedades

@router.post("/asunto/{asunto_id}", response_model=NovedadResponse, status_code=status.HTTP_201_CREATED)
async def create_novedad(
    asunto_id: uuid.UUID,
    payload: NovedadCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_office_user),
):
    """
    Registra una nueva novedad en el expediente.
    """
    asunto_repo = AsuntoRepository(db, current_user.firma_id)
    asunto = await asunto_repo.get_by_id(asunto_id)
    if not asunto or not can_access_asunto(current_user, asunto):
        raise NotFoundException(detail="Asunto no encontrado")
    if payload.publicado_al_cliente:
        require_publication_permission(current_user)

    repo = NovedadRepository(db, current_user.firma_id)
    data = payload.model_dump()
    data["asunto_id"] = asunto_id

    nueva_novedad = await repo.create(data, created_by_id=current_user.id)
    return nueva_novedad

@router.delete("/{novedad_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_novedad(
    novedad_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("administrador", "abogado")),
):
    """
    Elimina una novedad del historial.
    """
    repo = NovedadRepository(db, current_user.firma_id)
    novedad = await repo.get_by_id(novedad_id)
    if not novedad:
        raise NotFoundException(detail="Novedad no encontrada")
    asunto = await AsuntoRepository(db, current_user.firma_id).get_by_id(novedad.asunto_id)
    if not asunto or not can_access_asunto(current_user, asunto):
        raise NotFoundException(detail="Novedad no encontrada")
    if novedad.tipo != "nota":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este avance se gestiona desde su actuación de origen.",
        )
    success = await repo.soft_delete(novedad_id)
    if not success:
        raise NotFoundException(detail="Novedad no encontrada")
    return None
