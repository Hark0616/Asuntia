import os
import hashlib
from pathlib import Path, PureWindowsPath
import uuid
from typing import Optional, Dict, Any, Tuple

from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.core.document_policy import MAX_DOCUMENT_BYTES, UPLOAD_CHUNK_BYTES
from app.services.document_upload import validate_filename
from app.services.storage.base import BaseStorageService
from app.services.storage.onedrive import StorageError


class LocalStorageService(BaseStorageService):
    """Almacenamiento local privado, contenido dentro de una raíz estable."""

    def __init__(self, base_path: Optional[str] = None):
        self.base_path = Path(base_path or settings.LOCAL_STORAGE_PATH).resolve()

    def contained_path(self, value: str | Path) -> Path:
        path = Path(value)
        if not path.is_absolute() and (PureWindowsPath(value).drive or (os.name != "nt" and "\\" in str(value))):
            raise ValueError("Ruta de almacenamiento inválida")
        path = (path if path.is_absolute() else self.base_path / path).resolve()
        if path == self.base_path or not path.is_relative_to(self.base_path):
            raise ValueError("Ruta de almacenamiento inválida")
        return path

    def _matches(self, path: Path, sha256: str) -> bool:
        digest, size = hashlib.sha256(), 0
        with path.open("rb") as stream:
            while chunk := stream.read(UPLOAD_CHUNK_BYTES):
                size += len(chunk)
                if size > MAX_DOCUMENT_BYTES:
                    return False
                digest.update(chunk)
        return digest.hexdigest() == sha256

    async def verify_content(self, key: str, sha256: str) -> None:
        """No dar por disponible un original ausente o modificado."""
        path = self.contained_path(key)
        try:
            matches = await run_in_threadpool(self._matches, path, sha256)
        except FileNotFoundError:
            raise StorageError("missing", "El archivo guardado no está disponible. Solicita revisión a la firma.")
        if not matches:
            raise StorageError("integrity", "El archivo guardado no coincide con la carga original. No se sobrescribió.")

    async def write_idempotent(self, content: bytes, key: str) -> None:
        """Clave generada por operación; un reintento nunca sobrescribe otro contenido."""
        target = self.contained_path(key)
        temporary = self.contained_path(target.with_name(f".{target.stem}.part"))
        sha256 = hashlib.sha256(content).hexdigest()

        def write():
            if target.exists():
                if not self._matches(target, sha256):
                    raise StorageError("integrity", "El archivo guardado no coincide con la carga original. No se sobrescribió.")
                return
            target.parent.mkdir(parents=True, exist_ok=True)
            # El bloqueo por firma serializa estas escrituras. Solo se retira el
            # temporal de esta operación que pudo quedar tras detener el proceso.
            temporary.unlink(missing_ok=True)
            try:
                descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0), 0o600)
                with os.fdopen(descriptor, "wb") as stream:
                    stream.write(content)
                    stream.flush()
                    os.fsync(stream.fileno())
                os.replace(temporary, target)
            finally:
                temporary.unlink(missing_ok=True)

        await run_in_threadpool(write)

    async def create_folder(self, folder_name: str, parent_folder_id: Optional[str] = None) -> Tuple[str, str]:
        """Crea un directorio dentro de la raíz, sin aceptar nombres con rutas."""
        validate_filename(folder_name)
        parent = self.contained_path(parent_folder_id) if parent_folder_id else self.base_path
        target = self.contained_path(parent / folder_name)
        await run_in_threadpool(target.mkdir, parents=True, exist_ok=True)
        return str(target), ""

    async def upload_file(
        self,
        file_bytes: bytes,
        filename: str,
        mime_type: str,
        parent_folder_id: Optional[str] = None,
    ) -> Tuple[str, str, Optional[str], int]:
        """Escribe fuera del event loop y publica el archivo completo por renombre."""
        validate_filename(filename)
        target_dir = self.contained_path(parent_folder_id) if parent_folder_id else self.base_path
        # El nombre enviado nunca forma parte de la clave física.
        key = uuid.uuid4().hex
        target = self.contained_path(target_dir / f"{key}{Path(filename).suffix.lower()}")
        temporary = self.contained_path(target_dir / f".{key}.part")

        def write():
            target_dir.mkdir(parents=True, exist_ok=True)
            try:
                descriptor = os.open(
                    temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0), 0o600
                )
                with os.fdopen(descriptor, "wb") as stream:
                    stream.write(file_bytes)
                    stream.flush()
                    os.fsync(stream.fileno())
                os.replace(temporary, target)
            except BaseException:
                temporary.unlink(missing_ok=True)
                raise

        await run_in_threadpool(write)
        # La URL autorizada se asigna al registrar el UUID del documento.
        return str(target), "", None, len(file_bytes)

    async def get_file_metadata(self, external_file_id: str) -> Dict[str, Any]:
        """Una referencia inexistente o fuera de la raíz nunca genera metadatos."""
        path = self.contained_path(external_file_id)
        if not path.is_file():
            raise FileNotFoundError("Archivo no encontrado")
        stat = await run_in_threadpool(path.stat)
        return {"id": external_file_id, "name": path.name,
                "mimeType": "application/octet-stream", "size": stat.st_size,
                "webViewLink": "", "webContentLink": ""}

    async def create_case_folder_structure(self, radicado: str, root_folder_id: Optional[str] = None) -> Dict[str, Any]:
        """Conserva las cuatro categorías; la API suministra la identidad opaca."""
        root_case_id, _ = await self.create_folder(f"Expediente_{radicado}", parent_folder_id=root_folder_id)
        sub_names = {"anexo": "01_Anexos", "solicitud": "02_Solicitud",
                     "audiencia": "03_Audiencias", "liquidacion": "04_Liquidacion"}
        subfolders = {}
        for key, name in sub_names.items():
            subfolders[key], _ = await self.create_folder(name, parent_folder_id=root_case_id)
        return {"root_folder_id": root_case_id, "web_view_url": "", "subfolders": subfolders}
