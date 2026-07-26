import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.models.user import User
from app.schemas.cliente import ClienteResponse, ClienteCreate

router = APIRouter()
DEFAULT_FIRMA_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

@router.get("", response_model=List[ClienteResponse])
async def list_clientes(db: AsyncSession = Depends(get_db)):
    """
    Lista todos los clientes registrados en la firma.
    """
    stmt = (
        select(User)
        .where(User.firma_id == DEFAULT_FIRMA_ID)
        .where(User.rol == "cliente")
        .where(User.is_active == True)
        .order_by(User.nombre.asc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())

@router.post("", response_model=ClienteResponse, status_code=status.HTTP_201_CREATED)
async def create_cliente(payload: ClienteCreate, db: AsyncSession = Depends(get_db)):
    """
    Registra un nuevo cliente en la firma.
    """
    nuevo_cliente = User(
        id=uuid.uuid4(),
        firma_id=DEFAULT_FIRMA_ID,
        nombre=payload.nombre,
        cedula=payload.cedula,
        email=payload.email,
        telefono=payload.telefono,
        rol="cliente",
        is_active=True
    )
    db.add(nuevo_cliente)
    await db.commit()
    await db.refresh(nuevo_cliente)
    return nuevo_cliente
