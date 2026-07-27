import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.schemas.firma_storage import FirmaStorageConfigCreate, FirmaStorageConfigResponse
from app.repositories.firma_storage_repository import FirmaStorageRepository
from app.services.storage.factory import StorageFactory

router = APIRouter()

DEFAULT_FIRMA_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

@router.get("/config", response_model=FirmaStorageConfigResponse)
async def get_storage_config(db: AsyncSession = Depends(get_db)):
    """
    Obtiene la configuración de almacenamiento activa para la firma.
    """
    repo = FirmaStorageRepository(db, DEFAULT_FIRMA_ID)
    config = await repo.get_config()
    if not config:
        # Si no existe, crear la configuración por defecto (Mock/Drive Fallback)
        config = await repo.create_or_update_config(FirmaStorageConfigCreate(provider="mock", auth_type="none"))
    return config

@router.post("/config", response_model=FirmaStorageConfigResponse)
async def set_storage_config(
    payload: FirmaStorageConfigCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Actualiza la configuración de almacenamiento de la firma (Google Drive, OneDrive, Local).
    """
    repo = FirmaStorageRepository(db, DEFAULT_FIRMA_ID)
    config = await repo.create_or_update_config(payload)
    return config

@router.post("/config/test")
async def test_storage_connection(db: AsyncSession = Depends(get_db)):
    """
    Realiza un test de conexión en vivo con el proveedor configurado de la firma.
    """
    provider = await StorageFactory.get_provider_for_firma(db, DEFAULT_FIRMA_ID)
    try:
        # Intentar crear una carpeta temporal de prueba
        folder_id, url = await provider.create_folder("Test_Conexion_Asuntia")
        repo = FirmaStorageRepository(db, DEFAULT_FIRMA_ID)
        config = await repo.get_config()
        if config:
            config.last_verified_at = datetime.now(timezone.utc)
            await db.commit()
        return {
            "status": "success",
            "provider": type(provider).__name__,
            "folder_id": folder_id,
            "web_view_url": url,
            "message": "Conexión con el proveedor probada exitosamente."
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error probando conexión con el proveedor: {str(e)}"
        )
