from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, Tuple

class BaseStorageService(ABC):
    """
    Interfaz abstracta desacoplada para proveedores de almacenamiento de archivos.
    Permite alternar entre Google Drive, OneDrive (Microsoft Graph API) o almacenamiento local sin tocar el dominio de negocio.
    """

    @abstractmethod
    async def create_folder(self, folder_name: str, parent_folder_id: Optional[str] = None) -> Tuple[str, str]:
        """
        Crea una carpeta en el almacenamiento externo.
        Retorna (folder_id, web_view_url).
        """
        pass

    @abstractmethod
    async def upload_file(
        self,
        file_bytes: bytes,
        filename: str,
        mime_type: str,
        parent_folder_id: Optional[str] = None
    ) -> Tuple[str, str, Optional[str], int]:
        """
        Subes un archivo al almacenamiento externo.
        Retorna (external_file_id, web_view_url, web_download_url, size_bytes).
        """
        pass

    @abstractmethod
    async def get_file_metadata(self, external_file_id: str) -> Dict[str, Any]:
        """
        Obtiene metadatos de un archivo por su ID externo.
        """
        pass

    @abstractmethod
    async def create_case_folder_structure(self, radicado: str, root_folder_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Crea la estructura estandarizada de 4 carpetas para un expediente legal:
        - 01_Anexos
        - 02_Solicitud
        - 03_Audiencias
        - 04_Liquidacion
        Retorna dict con root_folder_id y subfolders map.
        """
        pass
