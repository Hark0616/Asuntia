from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.core.deps import require_office_user, require_roles
from app.core.db import get_db
from app.models.user import User
from app.repositories.cliente_repository import ClienteRepository
from app.schemas.cliente import (
    ClienteAsignarResponsable,
    ClienteCreate,
    ClienteResponse,
)
from app.services.asignacion_service import AsignacionService
from app.services.cliente_service import ClienteService

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
    return await ClienteService(db, current_user.firma_id).create(
        payload,
        created_by_id=current_user.id,
        commit=True,
        responsable_id=(
            current_user.id
            if current_user.rol in {"administrador", "abogado"}
            else None
        ),
    )


@router.patch(
    "/{cliente_id}/responsable",
    response_model=ClienteResponse,
)
async def assign_client_responsible(
    cliente_id: uuid.UUID,
    payload: ClienteAsignarResponsable,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_roles("administrador", "auxiliar")
    ),
):
    """Asigna la relación principal de un cliente dentro de la firma."""
    return await AsignacionService(
        db, current_user.firma_id
    ).assign_client(cliente_id, payload.responsable_id)
