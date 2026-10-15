import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import require_office_user
from app.models.user import User
from app.schemas.cita import CitaCancelar, CitaCambioResponse, CitaCreate, CitaResponse, CitaUpdate
from app.services.cita_service import CitaService

router = APIRouter()


@router.get("/asunto/{asunto_id}", response_model=list[CitaResponse])
async def list_citas(asunto_id: uuid.UUID, db: AsyncSession = Depends(get_db), actor: User = Depends(require_office_user)):
    return await CitaService(db, actor.firma_id).list(asunto_id, actor)


@router.post("", response_model=CitaResponse, status_code=201)
async def create_cita(payload: CitaCreate, db: AsyncSession = Depends(get_db), actor: User = Depends(require_office_user)):
    return await CitaService(db, actor.firma_id).create(payload, actor)


@router.get("/{cita_id}", response_model=CitaResponse)
async def get_cita(cita_id: uuid.UUID, db: AsyncSession = Depends(get_db), actor: User = Depends(require_office_user)):
    return await CitaService(db, actor.firma_id).get(cita_id, actor)


@router.get("/{cita_id}/historial", response_model=list[CitaCambioResponse])
async def cita_history(cita_id: uuid.UUID, db: AsyncSession = Depends(get_db), actor: User = Depends(require_office_user)):
    service = CitaService(db, actor.firma_id)
    await service.get(cita_id, actor)
    return await service.citas.history(cita_id)


@router.put("/{cita_id}", response_model=CitaResponse)
async def update_cita(cita_id: uuid.UUID, payload: CitaUpdate, db: AsyncSession = Depends(get_db), actor: User = Depends(require_office_user)):
    return await CitaService(db, actor.firma_id).change(cita_id, payload, actor)


@router.post("/{cita_id}/cancelar", response_model=CitaResponse)
async def cancel_cita(cita_id: uuid.UUID, payload: CitaCancelar, db: AsyncSession = Depends(get_db), actor: User = Depends(require_office_user)):
    return await CitaService(db, actor.firma_id).change(cita_id, payload, actor, cancel=True)

