import uuid
from datetime import date
from secrets import token_hex
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.core.deps import get_current_user, require_office_user
from app.schemas.asunto import AsuntoResponse, AsuntoCreate, AsuntoUpdateEstado
from app.schemas.flujo import AvanzarPasoRequest
from app.repositories.asunto_repository import AsuntoRepository
from app.repositories.estado_repository import EstadoRepository
from app.repositories.user_repository import UserRepository
from app.core.exceptions import DomainException, NotFoundException
from app.models.user import User
from app.services.workflow_service import WorkflowService, initial_workflow_steps

router = APIRouter()


async def _resolve_internal_case_code(repo: AsuntoRepository, supplied_code: str | None) -> str:
    """Preserva códigos legados y genera uno interno para nuevas aperturas."""
    if supplied_code and supplied_code.strip():
        return supplied_code.strip()

    for _ in range(10):
        code = f"AS-{date.today().year}-{token_hex(3).upper()}"
        if not await repo.get_by_radicado(code):
            return code
    raise DomainException(detail="No fue posible asignar un código interno al expediente", status_code=503)

@router.get("", response_model=List[AsuntoResponse])
async def list_asuntos(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista todos los asuntos/expedientes de la firma activa.
    """
    repo = AsuntoRepository(db, current_user.firma_id)
    asuntos = (
        await repo.get_by_cliente_id(current_user.id, solo_publicas=True)
        if current_user.rol == "cliente"
        else await repo.list()
    )
    return asuntos

@router.post("", response_model=AsuntoResponse, status_code=status.HTTP_201_CREATED)
async def create_asunto(
    payload: AsuntoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_office_user),
):
    """
    Crea un nuevo asunto/expediente en la firma.
    """
    user_repo = UserRepository(db, current_user.firma_id)
    cliente = await user_repo.get_by_id(payload.cliente_id)
    if not cliente or cliente.rol != "cliente":
        raise NotFoundException(detail="Cliente no encontrado")
    if payload.abogado_id:
        abogado = await user_repo.get_by_id(payload.abogado_id)
        if not abogado or abogado.rol not in {"administrador", "abogado"}:
            raise NotFoundException(detail="Abogado no encontrado")
    repo = AsuntoRepository(db, current_user.firma_id)
    radicado = await _resolve_internal_case_code(repo, payload.radicado)
    if await repo.get_by_radicado(radicado):
        raise DomainException(detail="Ya existe un expediente con ese radicado")

    estado_repo = EstadoRepository(db, current_user.firma_id)
    estado_id = payload.estado_id
    if estado_id:
        if not await estado_repo.get_by_id(estado_id):
            raise NotFoundException(detail="Estado procesal no encontrado")
    else:
        estados = await estado_repo.list_ordered()
        estado_id = estados[0].id if estados else None

    data = payload.model_dump()
    data["radicado"] = radicado
    data.update(
        {
            "abogado_id": payload.abogado_id or current_user.id,
            "estado_id": estado_id,
            "etapa_actual": "Paso 1 de 5: Radicación",
            "siguiente_paso": payload.siguiente_paso or initial_workflow_steps()[0]["descripcion"],
            "ruta_codigo": "insolvencia_persona_natural",
            "paso_actual": 1,
            "flujo_estado": "activo",
        }
    )
    return await repo.create_with_workflow(
        data,
        initial_workflow_steps(),
        created_by_id=current_user.id,
    )

@router.get("/{radicado}", response_model=AsuntoResponse)
async def get_asunto(
    radicado: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene los detalles de un asunto por su número de radicado.
    """
    repo = AsuntoRepository(db, current_user.firma_id)
    asunto = await repo.get_by_radicado(
        radicado, solo_publicas=current_user.rol == "cliente"
    )
    if asunto and current_user.rol == "cliente" and asunto.cliente_id != current_user.id:
        asunto = None
    if not asunto:
        raise NotFoundException(detail=f"No se encontró el asunto con radicado {radicado}")
    return asunto

@router.patch("/{asunto_id}/estado", response_model=AsuntoResponse)
async def update_estado_asunto(
    asunto_id: uuid.UUID,
    payload: AsuntoUpdateEstado,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_office_user),
):
    """
    Actualiza el estado procesal o siguiente paso de un asunto.
    """
    repo = AsuntoRepository(db, current_user.firma_id)
    asunto = await repo.get_by_id(asunto_id)
    if not asunto:
        raise NotFoundException(detail="Asunto no encontrado")

    update_data = payload.model_dump(exclude_unset=True)
    if "estado_id" in update_data and update_data["estado_id"]:
        estado_id = uuid.UUID(str(update_data["estado_id"]))
        if not await EstadoRepository(db, current_user.firma_id).get_by_id(estado_id):
            raise NotFoundException(detail="Estado procesal no encontrado")
        update_data["estado_id"] = estado_id

    await repo.update(asunto, update_data)
    updated_asunto = await repo.get_by_id(asunto_id)
    return updated_asunto


@router.post("/{asunto_id}/flujo/avanzar", response_model=AsuntoResponse)
async def advance_asunto_workflow(
    asunto_id: uuid.UUID,
    payload: AvanzarPasoRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_office_user),
):
    """Completa el paso activo y habilita el siguiente de forma atómica."""
    return await WorkflowService(db, current_user.firma_id).advance(
        asunto_id=asunto_id,
        paso_codigo=payload.paso_codigo,
        data=payload.datos,
        user_id=current_user.id,
    )

@router.delete("/{asunto_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asunto(
    asunto_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_office_user),
):
    """
    Elimina (soft delete) un asunto de la firma.
    """
    repo = AsuntoRepository(db, current_user.firma_id)
    success = await repo.soft_delete(asunto_id)
    if not success:
        raise NotFoundException(detail="Asunto no encontrado")
    return None
