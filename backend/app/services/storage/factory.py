import uuid
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.firma_storage import FirmaStorageConfig
from app.services.storage.base import BaseStorageService
from app.services.storage.google_drive import GoogleDriveStorageService
from app.services.storage.local_storage import LocalStorageService

class StorageFactory:
    """
    Factoría estática que instancia dinámicamente el proveedor de almacenamiento adecuado según la Firma.
    """

    @staticmethod
    async def get_provider_for_firma(session: AsyncSession, firma_id: uuid.UUID) -> BaseStorageService:
        res = await session.execute(select(FirmaStorageConfig).where(FirmaStorageConfig.firma_id == firma_id))
        config = res.scalars().first()

        if not config or not config.is_active:
            # Fallback por defecto: Google Drive (en modo simulado si no hay credenciales)
            return GoogleDriveStorageService()

        provider = config.provider.lower()
        if provider == "local":
            return LocalStorageService()
        elif provider == "google_drive":
            return GoogleDriveStorageService()
        elif provider == "onedrive":
            # Para OneDrive se usará la misma interfaz una vez configurado Graph API
            return GoogleDriveStorageService()
        else:
            return GoogleDriveStorageService()
