import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.firma_storage_repository import FirmaStorageRepository
from app.services.storage.base import BaseStorageService
from app.services.storage.local_storage import LocalStorageService
from app.services.storage.google_drive import GoogleDriveStorageService

class StorageFactory:
    """
    Factoría estática que instancia dinámicamente el proveedor de almacenamiento adecuado según la Firma.
    """

    @staticmethod
    async def get_provider_for_firma(session: AsyncSession, firma_id: uuid.UUID) -> BaseStorageService:
        config = await FirmaStorageRepository(session, firma_id).get_config()

        if not config or not config.is_active:
            return LocalStorageService()

        provider = config.provider.lower()
        if provider == "local":
            return LocalStorageService()
        if provider == "google_drive":
            return GoogleDriveStorageService(
                config,
                FirmaStorageRepository(session, firma_id),
            )
        raise ValueError(
            f"El proveedor '{provider}' todavía no tiene una integración activa"
        )
