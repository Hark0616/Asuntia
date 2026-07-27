import os
import io
import uuid
import logging
from typing import Optional, Dict, Any, Tuple
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

from app.services.storage.base import BaseStorageService

logger = logging.getLogger(__name__)

SCOPES = ['https://www.googleapis.com/auth/drive']

class GoogleDriveStorageService(BaseStorageService):
    """
    Implementación del proveedor de almacenamiento de Google Drive API v3.
    """

    def __init__(self, credentials_path: Optional[str] = None):
        self.credentials_path = credentials_path or os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE")
        self.service = None
        self._initialize_client()

    def _initialize_client(self):
        if self.credentials_path and os.path.exists(self.credentials_path):
            try:
                creds = service_account.Credentials.from_service_account_file(
                    self.credentials_path, scopes=SCOPES
                )
                self.service = build('drive', 'v3', credentials=creds)
                logger.info("Cliente de Google Drive API v3 inicializado correctamente.")
            except Exception as e:
                logger.warning(f"No se pudo autenticar con Service Account de Google Drive: {e}. Operando en modo dev/fallback.")
                self.service = None
        else:
            logger.info("GOOGLE_SERVICE_ACCOUNT_FILE no configurado. Operando con fallback simulado para Google Drive.")

    async def create_folder(self, folder_name: str, parent_folder_id: Optional[str] = None) -> Tuple[str, str]:
        """
        Crea una subcarpeta en Google Drive.
        """
        if self.service:
            file_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder'
            }
            if parent_folder_id:
                file_metadata['parents'] = [parent_folder_id]

            folder = self.service.files().create(body=file_metadata, fields='id, webViewLink').execute()
            return folder.get('id'), folder.get('webViewLink')
        else:
            # Fallback simulado para entorno dev / pruebas
            mock_id = f"gdrive_folder_{uuid.uuid4().hex[:12]}"
            mock_url = f"https://drive.google.com/drive/folders/{mock_id}"
            return mock_id, mock_url

    async def upload_file(
        self,
        file_bytes: bytes,
        filename: str,
        mime_type: str,
        parent_folder_id: Optional[str] = None
    ) -> Tuple[str, str, Optional[str], int]:
        """
        Sube un archivo por streaming a Google Drive.
        """
        size_bytes = len(file_bytes)
        if self.service:
            file_metadata = {'name': filename}
            if parent_folder_id:
                file_metadata['parents'] = [parent_folder_id]

            media = MediaIoBaseUpload(io.BytesIO(file_bytes), mimetype=mime_type, resumable=True)
            file = self.service.files().create(
                body=file_metadata, media_body=media, fields='id, webViewLink, webContentLink'
            ).execute()

            file_id = file.get('id')
            web_view = file.get('webViewLink')
            web_download = file.get('webContentLink')

            # Permitir lectura a quienes tengan el enlace
            try:
                self.service.permissions().create(
                    fileId=file_id,
                    body={'type': 'anyone', 'role': 'reader'}
                ).execute()
            except Exception as pe:
                logger.warning(f"No se pudieron ajustar permisos públicos en Google Drive: {pe}")

            return file_id, web_view, web_download, size_bytes
        else:
            # Fallback simulado para entorno dev / pruebas
            mock_id = f"gdrive_file_{uuid.uuid4().hex[:12]}"
            mock_view = f"https://drive.google.com/file/d/{mock_id}/view"
            mock_download = f"https://drive.google.com/uc?id={mock_id}&export=download"
            return mock_id, mock_view, mock_download, size_bytes

    async def get_file_metadata(self, external_file_id: str) -> Dict[str, Any]:
        """
        Consulta los metadatos de un archivo en Google Drive.
        """
        if self.service:
            return self.service.files().get(
                fileId=external_file_id, fields='id, name, mimeType, size, webViewLink, webContentLink'
            ).execute()
        else:
            return {
                'id': external_file_id,
                'name': 'documento_simulado.pdf',
                'mimeType': 'application/pdf',
                'size': 102450,
                'webViewLink': f"https://drive.google.com/file/d/{external_file_id}/view",
                'webContentLink': f"https://drive.google.com/uc?id={external_file_id}&export=download"
            }

    async def create_case_folder_structure(self, radicado: str, root_folder_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Crea la carpeta del radicado y sus 4 subcarpetas oficiales (01_Anexos, 02_Solicitud, 03_Audiencias, 04_Liquidacion).
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
