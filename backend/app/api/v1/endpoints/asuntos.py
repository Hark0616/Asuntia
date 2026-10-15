import uuid
from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.core.access import can_access_asunto
from app.core.deps import get_current_user, require_office_user, require_roles
from app.schemas.asunto import (
    AperturaAsuntoCreate,
    AsuntoAsignarResponsable,
    AsuntoIncorporarGuia,
    AsuntoResponse,
    AsuntoCreate,
    AsuntoUpdateEstado,
    AsuntosPaginaResponse,
)
from app.schemas.flujo import AvanzarPasoRequest, GuardarPasoBorradorRequest
from app.schemas.portal import AsuntoPortalResponse
from app.repositories.asunto_repository import AsuntoRepository
from app.repositories.estado_repository import EstadoRepository
from app.core.exceptions import DomainException, NotFoundException
from app.models.user import User
from app.services.workflow_service import WorkflowService
from app.services.asunto_service import AsuntoService
from app.services.asignacion_service import AsignacionService

router = APIRouter()


@router.get("/busqueda", response_model=AsuntosPaginaResponse)
async def search_asuntos(
    pagina: int = Query(default=1, ge=1),
    por_pagina: int = Query(default=25, ge=1, le=100),
    q: str = Query(default="", max_length=160),
    cliente_id: uuid.UUID | None = None,
    responsable_id: uuid.UUID | None = None,
    estado_id: uuid.UUID | None = None,
    sin_responsable: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_office_user),
):
    """Busca resúmenes autorizados con orden estable y total de la consulta completa."""
    if sin_responsable and responsable_id is not None:
        raise DomainException(detail="Elige responsable o asuntos sin asignar", status_code=422)
    items, total = await AsuntoRepository(db, current_user.firma_id).search(
        pagina=pagina, por_pagina=por_pagina, q=q, cliente_id=cliente_id,
        responsable_id=responsable_id, estado_id=estado_id, sin_responsable=sin_responsable,
        abogado_scope=current_user.id if current_user.rol == "abogado" else None,
    )
    return AsuntosPaginaResponse(items=items, total=total, pagina=pagina, por_pagina=por_pagina)


@router.get("", response_model=List[AsuntoResponse | AsuntoPortalResponse])
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
        return [AsuntoPortalResponse.from_asunto(asunto) for asunto in asuntos]
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
    return await AsuntoService(db, current_user.firma_id).open(payload, current_user)


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
    return await AsuntoService(db, current_user.firma_id).open(payload, current_user)


@router.patch(
    "/{asunto_id}/responsable",
    response_model=AsuntoResponse,
)
async def assign_case_responsible(
    asunto_id: uuid.UUID,
    payload: AsuntoAsignarResponsable,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_roles("administrador")
    ),
):
    """Transfiere el asunto y el trabajo abierto de su responsable; conserva las delegaciones al equipo."""
    return await AsignacionService(
        db, current_user.firma_id
    ).assign_case(asunto_id, payload.responsable_id)

@router.get("/id/{asunto_id}", response_model=AsuntoResponse | AsuntoPortalResponse)
async def get_asunto_by_id(
    asunto_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Consulta directa, independiente de la página cargada en la lista."""
    asunto = await AsuntoRepository(db, current_user.firma_id).get_by_id(
        asunto_id, solo_publicas=current_user.rol == "cliente",
    )
    if asunto is None or not can_access_asunto(current_user, asunto):
        raise NotFoundException(detail="Asunto no encontrado")
    if current_user.rol == "cliente":
        return AsuntoPortalResponse.from_asunto(asunto)
    return asunto


@router.post("/{asunto_id}/guia", response_model=AsuntoResponse)
async def attach_asunto_workflow(
    asunto_id: uuid.UUID,
    payload: AsuntoIncorporarGuia,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("administrador", "abogado")),
):
    """Incorpora una guía sin reemplazar actuaciones existentes."""
    return await AsuntoService(db, current_user.firma_id).attach_workflow(
        asunto_id, payload.ruta_codigo, current_user,
    )


@router.get("/{radicado}", response_model=AsuntoResponse | AsuntoPortalResponse)
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
    if current_user.rol == "cliente":
        return AsuntoPortalResponse.from_asunto(asunto)
    return asunto

@router.patch("/{asunto_id}/estado", response_model=AsuntoResponse)
async def update_estado_asunto(
    asunto_id: uuid.UUID,
    payload: AsuntoUpdateEstado,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("administrador", "abogado")),
):
    """
    Actualiza el estado procesal de un asunto sin alterar su ruta de trabajo.
    """
    repo = AsuntoRepository(db, current_user.firma_id)
    asunto = await repo.get_by_id_for_update(asunto_id)
    if not asunto or not can_access_asunto(current_user, asunto):
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
        expected_updated_at=payload.expected_updated_at,
    )


@router.patch("/{asunto_id}/flujo/borrador", response_model=AsuntoResponse)
async def save_asunto_workflow_draft(
    asunto_id: uuid.UUID,
    payload: GuardarPasoBorradorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_office_user),
):
    """Guarda la captura parcial del paso activo sin completar ni publicar."""
    return await WorkflowService(db, current_user.firma_id).save_draft(
        asunto_id=asunto_id,
        paso_codigo=payload.paso_codigo,
        data=payload.datos,
        user_id=current_user.id,
        user_role=current_user.rol,
        expected_updated_at=payload.expected_updated_at,
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
