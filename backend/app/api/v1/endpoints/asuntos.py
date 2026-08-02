import uuid
from datetime import date
from secrets import token_hex
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.core.access import can_access_asunto
from app.core.deps import get_current_user, require_office_user, require_roles
from app.schemas.asunto import (
    AperturaAsuntoCreate,
    AsuntoAsignarResponsable,
    AsuntoResponse,
    AsuntoCreate,
    AsuntoUpdateEstado,
)
from app.schemas.flujo import AvanzarPasoRequest
from app.repositories.asunto_repository import AsuntoRepository
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.estado_repository import EstadoRepository
from app.repositories.user_repository import UserRepository
from app.core.exceptions import DomainException, NotFoundException
from app.models.user import User
from app.services.workflow_service import WorkflowService, initial_workflow_steps
from app.services.cliente_service import ClienteService
from app.services.asignacion_service import AsignacionService

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


async def _open_case(
    *,
    cliente_id: uuid.UUID,
    abogado_id: uuid.UUID | None,
    estado_id: uuid.UUID | None,
    fecha_apertura: date,
    supplied_code: str | None,
    db: AsyncSession,
    current_user: User,
) -> AsuntoResponse:
    cliente = await ClienteRepository(
        db, current_user.firma_id
    ).get_by_id(cliente_id)
    if not cliente:
        raise NotFoundException(detail="Cliente no encontrado")
    responsable_id = await _resolve_case_responsible(
        db=db,
        current_user=current_user,
        requested_id=abogado_id,
    )

    repo = AsuntoRepository(db, current_user.firma_id)
    radicado = await _resolve_internal_case_code(repo, supplied_code)
    if await repo.get_by_radicado(radicado):
        raise DomainException(detail="Ya existe un expediente con ese radicado")

    estado_repo = EstadoRepository(db, current_user.firma_id)
    if estado_id:
        if not await estado_repo.get_by_id(estado_id):
            raise NotFoundException(detail="Estado procesal no encontrado")
    else:
        estados = await estado_repo.list_ordered()
        estado_id = estados[0].id if estados else None

    steps = initial_workflow_steps()
    return await repo.create_with_workflow(
        {
            "cliente_id": cliente_id,
            "abogado_id": responsable_id,
            "estado_id": estado_id,
            "fecha_apertura": fecha_apertura,
            "radicado": radicado,
            "etapa_actual": (
                f"Paso 1 de {len(steps)}: {steps[0]['titulo']}"
            ),
            "siguiente_paso": steps[0]["descripcion"],
            "ruta_codigo": "insolvencia_persona_natural:v2",
            "paso_actual": 1,
            "flujo_estado": "activo",
        },
        steps,
        created_by_id=current_user.id,
    )


async def _resolve_case_responsible(
    *,
    db: AsyncSession,
    current_user: User,
    requested_id: uuid.UUID | None,
) -> uuid.UUID:
    user_repo = UserRepository(db, current_user.firma_id)
    responsable_id = requested_id
    if (
        current_user.rol == "abogado"
        and responsable_id is not None
        and responsable_id != current_user.id
    ):
        raise DomainException(
            detail="Un abogado sólo puede asignarse asuntos a sí mismo",
            status_code=status.HTTP_403_FORBIDDEN,
        )
    if responsable_id:
        abogado = await user_repo.get_case_responsible(responsable_id)
        if not abogado:
            raise NotFoundException(detail="Abogado no encontrado")
    elif current_user.rol in {"administrador", "abogado"}:
        responsable_id = current_user.id
    else:
        raise DomainException(
            detail="Debes asignar un abogado responsable al abrir el asunto",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
    return responsable_id

@router.get("", response_model=List[AsuntoResponse])
async def list_asuntos(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista todos los asuntos/expedientes de la firma activa.
    """
    repo = AsuntoRepository(db, current_user.firma_id)
    if current_user.rol == "cliente":
        asuntos = await repo.get_by_portal_user_id(
            current_user.id, solo_publicas=True
        )
    elif current_user.rol == "abogado":
        asuntos = await repo.list_by_abogado_id(current_user.id)
    else:
        asuntos = await repo.list()
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
    return await _open_case(
        cliente_id=payload.cliente_id,
        abogado_id=payload.abogado_id,
        estado_id=payload.estado_id,
        fecha_apertura=payload.fecha_apertura,
        supplied_code=payload.radicado,
        db=db,
        current_user=current_user,
    )


@router.post(
    "/apertura",
    response_model=AsuntoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def open_asunto(
    payload: AperturaAsuntoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_office_user),
):
    """Abre un asunto con un cliente existente o un perfil nuevo."""
    cliente_id = payload.cliente_id
    responsable_id = await _resolve_case_responsible(
        db=db,
        current_user=current_user,
        requested_id=payload.abogado_id,
    )
    if payload.cliente_nuevo:
        cliente = await ClienteService(
            db, current_user.firma_id
        ).create(
            payload.cliente_nuevo,
            created_by_id=current_user.id,
            commit=False,
            responsable_id=responsable_id,
        )
        cliente_id = cliente.id

    if cliente_id is None:
        raise DomainException(
            detail="Debes seleccionar un cliente",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
    return await _open_case(
        cliente_id=cliente_id,
        abogado_id=responsable_id,
        estado_id=None,
        fecha_apertura=payload.fecha_apertura,
        supplied_code=None,
        db=db,
        current_user=current_user,
    )


@router.patch(
    "/{asunto_id}/responsable",
    response_model=AsuntoResponse,
)
async def assign_case_responsible(
    asunto_id: uuid.UUID,
    payload: AsuntoAsignarResponsable,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_roles("administrador", "auxiliar")
    ),
):
    """Transfiere el asunto y todo su trabajo abierto a otro responsable."""
    return await AsignacionService(
        db, current_user.firma_id
    ).assign_case(asunto_id, payload.responsable_id)

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
    if asunto and not can_access_asunto(current_user, asunto):
        asunto = None
    if not asunto:
        raise NotFoundException(detail=f"No se encontró el asunto con radicado {radicado}")
    return asunto

@router.patch("/{asunto_id}/estado", response_model=AsuntoResponse)
async def update_estado_asunto(
    asunto_id: uuid.UUID,
    payload: AsuntoUpdateEstado,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("administrador")),
):
    """
    Actualiza el estado procesal de un asunto sin alterar su ruta de trabajo.
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
    current_user: User = Depends(require_roles("administrador", "abogado")),
):
    """Completa el paso activo y habilita el siguiente de forma atómica."""
    return await WorkflowService(db, current_user.firma_id).advance(
        asunto_id=asunto_id,
        paso_codigo=payload.paso_codigo,
        data=payload.datos,
        user_id=current_user.id,
        user_role=current_user.rol,
    )

@router.delete("/{asunto_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asunto(
    asunto_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("administrador")),
):
    """
    Elimina (soft delete) un asunto de la firma.
    """
    repo = AsuntoRepository(db, current_user.firma_id)
    success = await repo.soft_delete(asunto_id)
    if not success:
        raise NotFoundException(detail="Asunto no encontrado")
    return None
