from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.core.deps import require_office_user, require_roles
from app.core.db import get_db
from app.core.exceptions import NotFoundException
from app.models.user import User
from app.repositories.cliente_repository import ClienteRepository
from app.schemas.cliente import (
    ClienteAsignarResponsable,
    ClienteCreate,
    ClienteResponse,
    ClienteUpdate,
)
from app.services.asignacion_service import AsignacionService
from app.services.cliente_service import ClienteService
from app.services.office_lock import lock_office_actor

router = APIRouter()


@router.get("/{cliente_id}", response_model=ClienteResponse)
async def get_cliente(cliente_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                      current_user: User = Depends(require_office_user)):
    cliente = await ClienteRepository(db, current_user.firma_id).get_by_id(
        cliente_id, abogado_scope=current_user.id if current_user.rol == "abogado" else None)
    if cliente is None:
        raise NotFoundException(detail="Cliente no encontrado")
    return cliente


@router.patch("/{cliente_id}", response_model=ClienteResponse)
async def edit_cliente(cliente_id: uuid.UUID, payload: ClienteUpdate,
                       db: AsyncSession = Depends(get_db),
                       current_user: User = Depends(require_roles("administrador", "auxiliar"))):
    return await ClienteService(db, current_user.firma_id).edit(cliente_id, payload, current_user)

@router.get("", response_model=List[ClienteResponse])
async def list_clientes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_office_user),
):
    """
    Lista todos los clientes registrados en la firma.
    """
    return await ClienteRepository(db, current_user.firma_id).list(
        abogado_scope=current_user.id if current_user.rol == "abogado" else None,
    )

@router.post("", response_model=ClienteResponse, status_code=status.HTTP_201_CREATED)
async def create_cliente(
    payload: ClienteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_office_user),
):
    """
    Registra un nuevo cliente en la firma.
    """
    await lock_office_actor(db, current_user.firma_id, current_user.id, current_user.rol)
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
        require_roles("administrador")
    ),
):
    """Asigna la relación principal de un cliente dentro de la firma."""
    return await AsignacionService(
        db, current_user.firma_id
    ).assign_client(cliente_id, payload.responsable_id, current_user)
