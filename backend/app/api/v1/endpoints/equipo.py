from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import require_office_user
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.equipo import ResponsableAsuntoResponse


router = APIRouter()


@router.get("/responsables", response_model=list[ResponsableAsuntoResponse])
async def list_case_responsibles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_office_user),
):
    """Lista quienes pueden quedar responsables de un asunto."""
    return await UserRepository(
        db, current_user.firma_id
    ).list_case_responsibles()
