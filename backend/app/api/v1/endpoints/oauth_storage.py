import uuid
from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.repositories.firma_storage_repository import FirmaStorageRepository
from app.schemas.firma_storage import FirmaStorageConfigCreate

router = APIRouter()

DEFAULT_FIRMA_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

@router.get("/auth-url")
async def get_oauth_auth_url(provider: str = Query("google_drive", description="google_drive u onedrive")):
    """
    Retorna la URL oficial de redirección OAuth2 para conectar la cuenta corporativa de la firma.
    """
    if provider == "google_drive":
        # Simulación de URL OAuth2 de Google Workspace
        client_id = "asuntia-google-client-id"
        redirect_uri = "http://localhost:8000/api/v1/storage/oauth-callback"
        scope = "https://www.googleapis.com/auth/drive.file"
        auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id={client_id}&redirect_uri={redirect_uri}&scope={scope}&access_type=offline"
        return {"provider": "google_drive", "auth_url": auth_url}
    elif provider == "onedrive":
        # Simulación de URL OAuth2 de Microsoft Graph API
        client_id = "asuntia-microsoft-client-id"
        redirect_uri = "http://localhost:8000/api/v1/storage/oauth-callback"
        scope = "Files.ReadWrite.All"
        auth_url = f"https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id={client_id}&response_type=code&redirect_uri={redirect_uri}&scope={scope}"
        return {"provider": "onedrive", "auth_url": auth_url}
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Proveedor de almacenamiento no soportado.")

@router.get("/oauth-callback")
async def oauth_callback(
    code: str = Query(..., description="Código de autorización del proveedor"),
    db: AsyncSession = Depends(get_db)
):
    """
    Procesa el callback del proveedor OAuth2 y guarda la cuenta conectada.
    """
    repo = FirmaStorageRepository(db, DEFAULT_FIRMA_ID)
    await repo.create_or_update_config(
        FirmaStorageConfigCreate(
            provider="google_drive",
            auth_type="oauth2",
            is_active=True
        )
    )
    # Redirigir de regreso al frontend con flag de éxito
    return RedirectResponse(url="http://localhost:5173/?storage_connected=true")
