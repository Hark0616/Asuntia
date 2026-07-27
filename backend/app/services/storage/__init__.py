from app.services.storage.base import BaseStorageService
from app.services.storage.google_drive import GoogleDriveStorageService
from app.services.storage.local_storage import LocalStorageService
from app.services.storage.factory import StorageFactory

# Proveedor por defecto de la aplicación
storage_service: BaseStorageService = GoogleDriveStorageService()

__all__ = ["BaseStorageService", "GoogleDriveStorageService", "LocalStorageService", "StorageFactory", "storage_service"]
