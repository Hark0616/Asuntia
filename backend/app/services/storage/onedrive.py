"""Adaptador de Graph: se invoca exclusivamente desde el worker documental."""
from urllib.parse import quote, unquote, urlsplit
import logging

import httpx

from app.core.document_policy import MAX_DOCUMENT_BYTES
from app.services.storage.base import BaseStorageService

GRAPH = "https://graph.microsoft.com/v1.0"
TOKEN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token"
SCOPES = "offline_access Files.ReadWrite"
# httpx INFO imprime URLs de descarga preautorizadas; solo registrar diagnósticos
# propios por operación, nunca credenciales, headers ni URLs temporales.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)


class StorageError(Exception):
    def __init__(self, code: str, message: str, retryable=False):
        super().__init__(message)
        self.code, self.message, self.retryable = code, message, retryable


def check_response(response):
    if response.status_code < 400:
        return
    code = response.status_code
    if code in (401, 403):
        raise StorageError("reconnect", "Reconecta OneDrive y verifica los permisos de la cuenta.")
    if code == 404:
        raise StorageError("missing", "El archivo o la carpeta ya no está disponible en OneDrive.")
    if code in (409, 412):
        raise StorageError("conflict", "El archivo cambió. Actualiza y vuelve a revisarlo.")
    raise StorageError("provider", "OneDrive no pudo completar la operación. Inténtalo de nuevo.", code == 429 or code >= 500)


class OneDriveStorageService(BaseStorageService):
    def __init__(self, access_token: str, drive_id: str, root_folder_id: str | None = None, transport=None):
        self.drive_id, self.root_folder_id = drive_id, root_folder_id
        self.transport = transport
        self.client = httpx.AsyncClient(headers={"Authorization": f"Bearer {access_token}"},
                                       timeout=30, follow_redirects=False, trust_env=False, transport=transport)

    async def close(self):
        await self.client.aclose()

    def item_path(self, id):
        base = f"/drives/{quote(self.drive_id, safe='')}"
        return f"{base}/root" if id == "root" else f"{base}/items/{quote(id, safe='')}"

    async def request(self, method, path, **kwargs):
        response = await self.client.request(method, GRAPH + path, **kwargs)
        check_response(response)
        return response.json()

    async def get_file_metadata(self, external_file_id):
        item = await self.request("GET", self.item_path(external_file_id), params={
            "$select": "id,name,size,file,folder,parentReference,eTag,remoteItem,deleted,package"})
        if "remoteItem" in item or "deleted" in item or "package" in item:
            raise StorageError("unsupported", "Selecciona un archivo o carpeta propia de esta cuenta.")
        return item

    async def require_descendant(self, item, root_id, *, allow_root=False):
        root = await self.get_file_metadata(root_id)
        current = item
        seen = set()
        for _ in range(60):
            if current.get("id") == root["id"]:
                if allow_root or item.get("id") != root["id"]:
                    return
                break
            parent = current.get("parentReference") or {}
            if parent.get("driveId") not in (None, self.drive_id):
                break
            parent_id = parent.get("id")
            if not parent_id or parent_id in seen:
                break
            seen.add(parent_id)
            current = await self.get_file_metadata(parent_id)
        raise StorageError("outside_folder", "El elemento está fuera de la carpeta autorizada.")

    async def list_children(self, parent_id, next_link=None):
        path = self.item_path(parent_id) + "/children"
        if next_link:
            parsed = urlsplit(next_link)
            if (parsed.scheme != "https" or parsed.netloc != "graph.microsoft.com"
                    or unquote(parsed.path) != unquote("/v1.0" + path) or parsed.fragment):
                raise StorageError("cursor", "La página de OneDrive no es válida. Actualiza la carpeta.")
            response = await self.client.get(next_link)
            check_response(response)
            return response.json()
        return await self.request("GET", path, params={"$top": 100, "$orderby": "name",
                                  "$select": "id,name,size,folder,file,remoteItem,deleted,package"})

    async def read_content(self, item_id: str):
        # Graph puede redirigir a una URL temporal. Nunca se devuelve al navegador
        # ni se reenvía el Bearer de Graph al host de descarga.
        url = GRAPH + self.item_path(item_id) + "/content"
        client = self.client
        download_client = None
        try:
            for _ in range(4):
                async with client.stream("GET", url) as response:
                    if response.status_code in (301, 302, 303, 307, 308):
                        url = response.headers.get("location", "")
                        parsed = urlsplit(url)
                        host = parsed.hostname or ""
                        if (parsed.scheme != "https" or parsed.username or parsed.password
                                or parsed.port not in (None, 443)
                                or not (host.endswith(".1drv.com") or host.endswith(".files.live.com")
                                        or host.endswith(".sharepoint.com") or host.endswith(".onedrive.com"))):
                            raise StorageError("download_host", "OneDrive devolvió una descarga no admitida.")
                        if download_client is None:
                            download_client = httpx.AsyncClient(timeout=30, follow_redirects=False,
                                                               trust_env=False, transport=self.transport)
                        client = download_client
                        continue
                    check_response(response)
                    result = bytearray()
                    async for chunk in response.aiter_bytes(64 * 1024):
                        result.extend(chunk)
                        if len(result) > MAX_DOCUMENT_BYTES:
                            raise StorageError("size", "El archivo supera el límite de 20 MiB.")
                    return bytes(result)
            raise StorageError("redirect", "No se pudo obtener el contenido de OneDrive.")
        finally:
            if download_client:
                await download_client.aclose()

    async def create_folder(self, folder_name, parent_folder_id=None):
        parent = parent_folder_id or self.root_folder_id
        result = await self.request("POST", self.item_path(parent) + "/children", json={
            "name": folder_name, "folder": {}, "@microsoft.graph.conflictBehavior": "fail"})
        return result["id"], ""

    async def upload_file(self, file_bytes, filename, mime_type, parent_folder_id=None):
        parent = parent_folder_id or self.root_folder_id
        result = await self.request("PUT", self.item_path(parent) + f":/{quote(filename, safe='')}:/content",
                                    params={"@microsoft.graph.conflictBehavior": "fail"},
                                    headers={"Content-Type": mime_type, "If-None-Match": "*"}, content=file_bytes)
        return result["id"], "", None, int(result["size"])

    async def named_child(self, parent_id, name):
        try:
            return await self.request("GET", self.item_path(parent_id) + f":/{quote(name, safe='')}")
        except StorageError as exc:
            if exc.code == "missing":
                return None
            raise

    async def create_case_folder_structure(self, radicado, root_folder_id=None):
        # La conexión remota no impone cuatro carpetas a un archivo preexistente.
        parent = root_folder_id or self.root_folder_id
        name = f"Expediente_{radicado}"
        item = await self.named_child(parent, name)
        if item is None:
            folder_id, _ = await self.create_folder(name, parent)
        else:
            if "folder" not in item:
                raise StorageError("conflict", "Ya existe un archivo con el nombre de la carpeta del expediente.")
            folder_id = item["id"]
        return {"root_folder_id": folder_id, "web_view_url": "", "subfolders": {}}
