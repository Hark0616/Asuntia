from app.services.storage.base import BaseStorageService
from app.services.storage.local_storage import LocalStorageService
from app.services.storage.factory import StorageFactory

# Proveedor local para compatibilidad con consumidores anteriores a StorageFactory.
storage_service: BaseStorageService = LocalStorageService()

__all__ = ["BaseStorageService", "LocalStorageService", "StorageFactory", "storage_service"]
