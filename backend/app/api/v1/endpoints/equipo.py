import uuid

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import require_admin_user, require_office_user
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.equipo import (
    ResponsableAsuntoResponse, MiembroEquipoResponse, InvitacionEquipoCreate,
    InvitacionEquipoResponse, EquipoVersion, CambioRolEquipo, BajaEquipo,
)
from app.services.equipo_service import EquipoService


router = APIRouter()


@router.get("/gestion", response_model=list[MiembroEquipoResponse])
async def list_managed_members(db: AsyncSession = Depends(get_db),
                               current_user: User = Depends(require_admin_user)):
    return await EquipoService(db, current_user.firma_id).list_members()


@router.post("/invitaciones", response_model=InvitacionEquipoResponse, status_code=201)
async def invite_member(payload: InvitacionEquipoCreate, response: Response,
                        db: AsyncSession = Depends(get_db),
                        current_user: User = Depends(require_admin_user)):
    response.headers["Cache-Control"] = "no-store"
    return await EquipoService(db, current_user.firma_id).invite(payload, current_user)


@router.post("/{user_id}/invitacion", response_model=InvitacionEquipoResponse)
async def reinvite_member(user_id: uuid.UUID, payload: EquipoVersion, response: Response,
                          db: AsyncSession = Depends(get_db),
                          current_user: User = Depends(require_admin_user)):
    response.headers["Cache-Control"] = "no-store"
    return await EquipoService(db, current_user.firma_id).reinvite(user_id, payload, current_user)


@router.patch("/{user_id}/rol", response_model=MiembroEquipoResponse)
async def change_member_role(user_id: uuid.UUID, payload: CambioRolEquipo,
                             db: AsyncSession = Depends(get_db),
                             current_user: User = Depends(require_admin_user)):
    return await EquipoService(db, current_user.firma_id).change(user_id, payload, current_user)


@router.post("/{user_id}/desactivar", response_model=MiembroEquipoResponse)
async def deactivate_member(user_id: uuid.UUID, payload: BajaEquipo,
                            db: AsyncSession = Depends(get_db),
                            current_user: User = Depends(require_admin_user)):
    return await EquipoService(db, current_user.firma_id).change(
        user_id, payload, current_user, deactivate=True)


@router.get("/miembros", response_model=list[ResponsableAsuntoResponse])
async def list_office_members(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_office_user),
):
    """Equipo activo de la firma para delegar trabajo interno."""
    return await UserRepository(db, current_user.firma_id).list_office_members()


@router.get("/responsables", response_model=list[ResponsableAsuntoResponse])
async def list_case_responsibles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_office_user),
):
    """Lista quienes pueden quedar responsables de un asunto."""
    return await UserRepository(
        db, current_user.firma_id
    ).list_case_responsibles()
