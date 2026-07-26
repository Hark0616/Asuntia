import uuid
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.models.estado import EstadoProcesal
from app.schemas.asunto import EstadoProcesalResponse

router = APIRouter()
DEFAULT_FIRMA_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

@router.get("", response_model=List[EstadoProcesalResponse])
async def list_estados(db: AsyncSession = Depends(get_db)):
    """
    Lista el catálogo oficial de estados procesales de la firma.
    """
    stmt = (
        select(EstadoProcesal)
        .where(EstadoProcesal.firma_id == DEFAULT_FIRMA_ID)
        .where(EstadoProcesal.is_active == True)
        .order_by(EstadoProcesal.orden.asc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())
