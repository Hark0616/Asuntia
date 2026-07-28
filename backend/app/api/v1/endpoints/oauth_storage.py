from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.db import get_db
from app.core.deps import require_admin_user
from app.models.user import User
from app.repositories.firma_storage_repository import FirmaStorageRepository
from app.services.storage.google_oauth import GoogleOAuthService

router = APIRouter()

@router.get("/auth-url")
async def get_oauth_auth_url(
    provider: str = Query("google_drive", description="google_drive u onedrive"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_user),
):
    """
    Retorna la URL oficial de redirección OAuth2 para conectar la cuenta corporativa de la firma.
    """
    if provider != "google_drive":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Proveedor de almacenamiento no soportado.")
    try:
        url = GoogleOAuthService(
            FirmaStorageRepository(db, current_user.firma_id)
        ).create_authorization_url(current_user.firma_id, current_user.id)
        return {"authorization_url": url}
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

@router.get("/oauth-callback")
async def oauth_callback(
    code: str = Query(..., description="Código de autorización del proveedor"),
    state: str = Query(..., description="Estado firmado de la conexión"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_user),
):
    """
    Procesa el callback del proveedor OAuth2 y guarda la cuenta conectada.
    """
    try:
        await GoogleOAuthService(
            FirmaStorageRepository(db, current_user.firma_id)
        ).exchange_code(
            code=code,
            state=state,
            firma_id=current_user.firma_id,
            user_id=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return RedirectResponse(f"{settings.FRONTEND_URL}/?storage=google-connected")
