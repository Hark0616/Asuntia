from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_current_user
from app.core.db import get_db
from app.models.estado import EstadoProcesal
from app.models.user import User
from app.repositories.estado_repository import EstadoRepository
from app.schemas.asunto import EstadoProcesalResponse

router = APIRouter()

@router.get("", response_model=List[EstadoProcesalResponse])
async def list_estados(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista el catálogo oficial de estados procesales de la firma.
    """
    return await EstadoRepository(db, current_user.firma_id).list_ordered()
