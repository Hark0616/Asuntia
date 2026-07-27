import os
import uuid
import logging
from typing import Optional, Dict, Any, Tuple
from app.services.storage.base import BaseStorageService

logger = logging.getLogger(__name__)

class LocalStorageService(BaseStorageService):
    """
    Implementación del proveedor de almacenamiento Local en servidor.
    Guarda archivos en la carpeta de almacenamiento del servidor.
    """

    def __init__(self, base_path: Optional[str] = None):
        self.base_path = base_path or os.path.join(os.getcwd(), "storage")
        os.makedirs(self.base_path, exist_ok=True)

    async def create_folder(self, folder_name: str, parent_folder_id: Optional[str] = None) -> Tuple[str, str]:
        """
        Crea un directorio en el sistema de archivos local.
        """
        if parent_folder_id and os.path.exists(parent_folder_id):
            target_dir = os.path.join(parent_folder_id, folder_name)
        else:
            target_dir = os.path.join(self.base_path, folder_name)

        os.makedirs(target_dir, exist_ok=True)
        return target_dir, f"file://{target_dir}"

    async def upload_file(
        self,
        file_bytes: bytes,
        filename: str,
        mime_type: str,
        parent_folder_id: Optional[str] = None
    ) -> Tuple[str, str, Optional[str], int]:
        """
        Guarda los bytes del archivo en el directorio local.
        """
        target_dir = parent_folder_id if (parent_folder_id and os.path.exists(parent_folder_id)) else self.base_path
        os.makedirs(target_dir, exist_ok=True)

        file_id = f"local_{uuid.uuid4().hex[:12]}_{filename}"
        file_path = os.path.join(target_dir, file_id)

        with open(file_path, "wb") as f:
            f.write(file_bytes)

        size_bytes = len(file_bytes)
        local_url = f"/api/v1/documentos/stream/{file_id}"
        return file_path, local_url, local_url, size_bytes

    async def get_file_metadata(self, external_file_id: str) -> Dict[str, Any]:
        """
        Obtiene metadatos del archivo local.
        """
        if os.path.exists(external_file_id):
            stat = os.stat(external_file_id)
            filename = os.path.basename(external_file_id)
            return {
                'id': external_file_id,
                'name': filename,
                'mimeType': 'application/octet-stream',
                'size': stat.st_size,
                'webViewLink': f"file://{external_file_id}",
                'webContentLink': f"file://{external_file_id}"
            }
        else:
            return {
                'id': external_file_id,
                'name': 'archivo_no_encontrado.pdf',
                'mimeType': 'application/pdf',
                'size': 0,
                'webViewLink': '',
                'webContentLink': ''
            }

    async def create_case_folder_structure(self, radicado: str, root_folder_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Crea la estructura de 4 carpetas locales para el radicado.
        """
        root_case_id, root_case_url = await self.create_folder(f"Expediente_{radicado}", parent_folder_id=root_folder_id)

        sub_names = {
            "anexo": "01_Anexos",
            "solicitud": "02_Solicitud",
            "audiencia": "03_Audiencias",
            "liquidacion": "04_Liquidacion"
        }

        subfolders = {}
        for key, name in sub_names.items():
            sub_id, _ = await self.create_folder(name, parent_folder_id=root_case_id)
            subfolders[key] = sub_id

        return {
            "root_folder_id": root_case_id,
            "web_view_url": root_case_url,
            "subfolders": subfolders
        }
