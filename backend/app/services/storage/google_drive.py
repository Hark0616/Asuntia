import asyncio
import io
from typing import Any, Dict, Optional, Tuple

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

from app.config import settings
from app.models.firma_storage import FirmaStorageConfig
from app.repositories.firma_storage_repository import FirmaStorageRepository
from app.services.storage.base import BaseStorageService
from app.services.storage.google_oauth import GOOGLE_DRIVE_SCOPES
from app.services.storage.token_cipher import StorageTokenCipher


class GoogleDriveStorageService(BaseStorageService):
    """Proveedor real de Google Drive autenticado por OAuth 2.0."""

    def __init__(
        self,
        config: FirmaStorageConfig,
        repository: FirmaStorageRepository,
    ):
        if not config.oauth_access_token_encrypted:
            raise ValueError("Google Drive todavía no está conectado")
        self.config = config
        self.repository = repository
        self.cipher = StorageTokenCipher()

    async def _credentials(self) -> Credentials:
        refresh_token = (
            self.cipher.decrypt(self.config.oauth_refresh_token_encrypted)
            if self.config.oauth_refresh_token_encrypted
            else None
        )
        credentials = Credentials(
            token=self.cipher.decrypt(self.config.oauth_access_token_encrypted),
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=GOOGLE_DRIVE_SCOPES,
        )
        if not credentials.valid:
            if not credentials.refresh_token:
                raise ValueError("Reconecta Google Drive para renovar la autorización")
            await asyncio.to_thread(credentials.refresh, Request())
            await self.repository.update_google_tokens(
                self.config,
                self.cipher.encrypt(credentials.token),
                self.cipher.encrypt(credentials.refresh_token),
                credentials.expiry,
            )
        return credentials

    async def _service(self):
        credentials = await self._credentials()
        return await asyncio.to_thread(
            build,
            "drive",
            "v3",
            credentials=credentials,
            cache_discovery=False,
        )

    async def _create_raw_folder(
        self, folder_name: str, parent_folder_id: Optional[str]
    ) -> Tuple[str, str]:
        service = await self._service()
        metadata: dict[str, Any] = {
            "name": folder_name,
            "mimeType": "application/vnd.google-apps.folder",
        }
        if parent_folder_id:
            metadata["parents"] = [parent_folder_id]
        result = await asyncio.to_thread(
            lambda: service.files()
            .create(
                body=metadata,
                fields="id,webViewLink",
                supportsAllDrives=True,
            )
            .execute()
        )
        folder_id = result["id"]
        return folder_id, result.get(
            "webViewLink", f"https://drive.google.com/drive/folders/{folder_id}"
        )

    async def _ensure_root(self) -> str:
        if self.config.root_folder_id:
            return self.config.root_folder_id
        root_id, _ = await self._create_raw_folder(
            self.config.root_folder_name or "Asuntia_Expedientes",
            None,
        )
        await self.repository.set_root_folder_id(self.config, root_id)
        return root_id

    async def create_folder(
        self, folder_name: str, parent_folder_id: Optional[str] = None
    ) -> Tuple[str, str]:
        parent = parent_folder_id or await self._ensure_root()
        return await self._create_raw_folder(folder_name, parent)

    async def upload_file(
        self,
        file_bytes: bytes,
        filename: str,
        mime_type: str,
        parent_folder_id: Optional[str] = None,
    ) -> Tuple[str, str, Optional[str], int]:
        service = await self._service()
        parent = parent_folder_id or await self._ensure_root()
        metadata: dict[str, Any] = {"name": filename}
        if parent:
            metadata["parents"] = [parent]
        media = MediaIoBaseUpload(
            io.BytesIO(file_bytes),
            mimetype=mime_type,
            resumable=True,
        )
        result = await asyncio.to_thread(
            lambda: service.files()
            .create(
                body=metadata,
                media_body=media,
                fields="id,webViewLink,webContentLink,size",
                supportsAllDrives=True,
            )
            .execute()
        )
        return (
            result["id"],
            result.get("webViewLink", ""),
            result.get("webContentLink"),
            int(result.get("size") or len(file_bytes)),
        )

    async def get_file_metadata(self, external_file_id: str) -> Dict[str, Any]:
        service = await self._service()
        return await asyncio.to_thread(
            lambda: service.files()
            .get(
                fileId=external_file_id,
                fields="id,name,mimeType,size,webViewLink,webContentLink",
                supportsAllDrives=True,
            )
            .execute()
        )

    async def create_case_folder_structure(
        self, radicado: str, root_folder_id: Optional[str] = None
    ) -> Dict[str, Any]:
        root_case_id, root_case_url = await self.create_folder(
            f"Expediente_{radicado}",
            parent_folder_id=root_folder_id,
        )
        subfolders = {}
        for key, name in {
            "anexo": "01_Anexos",
            "solicitud": "02_Solicitud",
            "audiencia": "03_Audiencias",
            "liquidacion": "04_Liquidacion",
        }.items():
            subfolders[key], _ = await self.create_folder(name, root_case_id)
        return {
            "root_folder_id": root_case_id,
            "web_view_url": root_case_url,
            "subfolders": subfolders,
        }
