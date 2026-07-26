import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.schemas.asunto import AsuntoResponse, AsuntoUpdateEstado
from app.repositories.asunto_repository import AsuntoRepository
from app.core.exceptions import NotFoundException

router = APIRouter()
DEFAULT_FIRMA_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

@router.get("", response_model=List[AsuntoResponse])
async def list_asuntos(db: AsyncSession = Depends(get_db)):
    """
    Lista todos los asuntos/expedientes de la firma activa.
    """
    repo = AsuntoRepository(db, DEFAULT_FIRMA_ID)
    asuntos = await repo.list()
    return asuntos

@router.get("/{radicado}", response_model=AsuntoResponse)
async def get_asunto(radicado: str, db: AsyncSession = Depends(get_db)):
    """
    Obtiene los detalles de un asunto por su número de radicado.
    """
    repo = AsuntoRepository(db, DEFAULT_FIRMA_ID)
    asunto = await repo.get_by_radicado(radicado)
    if not asunto:
        raise NotFoundException(detail=f"No se encontró el asunto con radicado {radicado}")
    return asunto

@router.patch("/{asunto_id}/estado", response_model=AsuntoResponse)
async def update_estado_asunto(asunto_id: uuid.UUID, payload: AsuntoUpdateEstado, db: AsyncSession = Depends(get_db)):
    """
    Actualiza manualmente el estadoprocesal o siguiente paso de un asunto.
    """
    repo = AsuntoRepository(db, DEFAULT_FIRMA_ID)
    asunto = await repo.get_by_id(asunto_id)
    if not asunto:
        raise NotFoundException(detail="Asunto no encontrado")

    update_data = payload.model_dump(exclude_unset=True)
    if "estado_id" in update_data and update_data["estado_id"]:
        update_data["estado_id"] = uuid.UUID(update_data["estado_id"])

    updated_asunto = await repo.update(asunto, update_data)
    return updated_asunto
