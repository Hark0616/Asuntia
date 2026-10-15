import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.firma_storage_repository import FirmaStorageRepository
from app.services.storage.base import BaseStorageService
from app.services.storage.local_storage import LocalStorageService
from app.services.storage.google_drive import GoogleDriveStorageService
from app.core.exceptions import DomainException

class StorageFactory:
    """
    Factoría estática que instancia dinámicamente el proveedor de almacenamiento adecuado según la Firma.
    """

    @staticmethod
    async def get_provider_for_firma(session: AsyncSession, firma_id: uuid.UUID) -> BaseStorageService:
        config = await FirmaStorageRepository(session, firma_id).get_config()

        if not config:
            return LocalStorageService()
        if not config.is_active:
            raise DomainException("El destino de almacenamiento está desactivado.", status_code=409)

        provider = config.provider.lower()
        if provider == "local":
            return LocalStorageService()
        if provider == "onedrive":
            raise DomainException("Usa la operación documental de OneDrive en segundo plano.", status_code=409)
        if provider == "google_drive":
            return GoogleDriveStorageService(
                config,
                FirmaStorageRepository(session, firma_id),
            )
        raise ValueError(
            f"El proveedor '{provider}' todavía no tiene una integración activa"
        )
