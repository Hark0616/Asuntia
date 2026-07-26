import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.schemas.novedad import NovedadCreate, NovedadResponse
from app.repositories.novedad_repository import NovedadRepository
from app.repositories.asunto_repository import AsuntoRepository
from app.core.exceptions import NotFoundException

router = APIRouter()
DEFAULT_FIRMA_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

@router.get("/asunto/{asunto_id}", response_model=List[NovedadResponse])
async def list_novedades(asunto_id: uuid.UUID, solo_publicas: bool = False, db: AsyncSession = Depends(get_db)):
    """
    Obtiene el historial de novedades de un asunto.
    """
    repo = NovedadRepository(db, DEFAULT_FIRMA_ID)
    novedades = await repo.get_by_asunto_id(asunto_id, solo_publicas=solo_publicas)
    return novedades

@router.post("/asunto/{asunto_id}", response_model=NovedadResponse, status_code=status.HTTP_201_CREATED)
async def create_novedad(asunto_id: uuid.UUID, payload: NovedadCreate, db: AsyncSession = Depends(get_db)):
    """
    Registra una nueva novedad en el expediente.
    """
    asunto_repo = AsuntoRepository(db, DEFAULT_FIRMA_ID)
    asunto = await asunto_repo.get_by_id(asunto_id)
    if not asunto:
        raise NotFoundException(detail="Asunto no encontrado")

    repo = NovedadRepository(db, DEFAULT_FIRMA_ID)
    data = payload.model_dump()
    data["asunto_id"] = asunto_id

    nueva_novedad = await repo.create(data)
    return nueva_novedad

@router.delete("/{novedad_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_novedad(novedad_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Elimina una novedad del historial.
    """
    repo = NovedadRepository(db, DEFAULT_FIRMA_ID)
    success = await repo.soft_delete(novedad_id)
    if not success:
        raise NotFoundException(detail="Novedad no encontrada")
    return None
