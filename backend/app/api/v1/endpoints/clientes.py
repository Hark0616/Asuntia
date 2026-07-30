from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import require_office_user
from app.core.db import get_db
from app.models.user import User
from app.repositories.cliente_repository import ClienteRepository
from app.schemas.cliente import ClienteResponse, ClienteCreate
from app.core.exceptions import DomainException

router = APIRouter()

@router.get("", response_model=List[ClienteResponse])
async def list_clientes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_office_user),
):
    """
    Lista todos los clientes registrados en la firma.
    """
    return await ClienteRepository(db, current_user.firma_id).list()

@router.post("", response_model=ClienteResponse, status_code=status.HTTP_201_CREATED)
async def create_cliente(
    payload: ClienteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_office_user),
):
    """
    Registra un nuevo cliente en la firma.
    """
    repo = ClienteRepository(db, current_user.firma_id)
    if await repo.get_by_document(payload.numero_documento):
        raise DomainException(detail="Ya existe un cliente con esa identificación")
    return await repo.create(
        payload.model_dump(),
        created_by_id=current_user.id,
    )
