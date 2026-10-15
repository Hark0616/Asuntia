"""ARQ ejecuta operaciones persistidas; Redis solo transporta sus UUID."""
from datetime import timedelta
import hashlib
from io import BytesIO
import logging
import os
from pathlib import Path
import uuid

from arq import cron
from arq.connections import RedisSettings
from fastapi import HTTPException, UploadFile
import httpx
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import Headers

from app.config import settings
from app.core.db import AsyncSessionLocal
from app.core.document_policy import MAX_DOCUMENT_BYTES, folder_for_document_type
from app.models.storage import StorageConnection
from app.repositories.documento_repository import DocumentoRepository
from app.repositories.firma_repository import FirmaRepository
from app.repositories.firma_storage_repository import FirmaStorageRepository
from app.repositories.novedad_repository import NovedadRepository
from app.repositories.storage_repository import StorageConnectionRepository, StorageOperationRepository
from app.services.document_upload import read_validated_upload
from app.services.storage.onedrive import OneDriveStorageService, StorageError, SCOPES, TOKEN_URL
from app.services.storage.operations import guard, now, seal, unseal
from app.services.storage.queue import HEARTBEAT
from app.services.storage.token_cipher import StorageTokenCipher
from app.services.storage.transfers import save_transfer, transfer_path, clear_transfers

logger = logging.getLogger(__name__)


async def token_request(data):
    async with httpx.AsyncClient(timeout=20, trust_env=False) as client:
        response = await client.post(TOKEN_URL, data={"client_id": settings.MICROSOFT_CLIENT_ID,
            "client_secret": settings.MICROSOFT_CLIENT_SECRET, "scope": SCOPES, **data})
    if response.status_code != 200:
        raise StorageError("reconnect", "Reconecta la cuenta de Microsoft para continuar.", response.status_code == 429 or response.status_code >= 500)
    tokens = response.json()
    if not tokens.get("access_token"):
        raise StorageError("reconnect", "Microsoft no devolvió una autorización válida.")
    tokens["expires_at"] = (now() + timedelta(seconds=min(int(tokens.get("expires_in", 3600)), 86400))).isoformat()
    return tokens


async def connection_client(session, operation):
    repo = StorageConnectionRepository(session, operation.firma_id)
    connection = await repo.get_locked(operation.connection_id)
    if not connection or connection.generation != operation.payload["generation"]:
        raise StorageError("reconnect", "La conexión cambió. Vuelve a intentarlo.")
    cipher = StorageTokenCipher()
    if connection.expires_at is None or connection.expires_at <= now() + timedelta(seconds=60):
        if not connection.refresh_token_cipher:
            raise StorageError("reconnect", "Reconecta OneDrive para renovar el acceso.")
        tokens = await token_request({"grant_type": "refresh_token", "refresh_token": cipher.decrypt(connection.refresh_token_cipher)})
        connection.access_token_cipher = cipher.encrypt(tokens["access_token"])
        if tokens.get("refresh_token"):
            connection.refresh_token_cipher = cipher.encrypt(tokens["refresh_token"])
        from datetime import datetime
        connection.expires_at = datetime.fromisoformat(tokens["expires_at"])
    access_token = cipher.decrypt(connection.access_token_cipher or "")
    client = OneDriveStorageService(access_token, connection.drive_id, connection.root_folder_id)
    await session.commit()  # Libera la conexión de BD antes de transferir archivos.
    return client, connection


async def validate_remote(client, item):
    if "file" not in item or "folder" in item:
        raise StorageError("format", "Selecciona un archivo admitido.")
    if int(item.get("size") or 0) > MAX_DOCUMENT_BYTES:
        raise StorageError("size", "El archivo supera el límite de 20 MiB.")
    content = await client.read_content(item["id"])
    upload = UploadFile(BytesIO(content), filename=item["name"], size=len(content),
                        headers=Headers({"content-type": (item.get("file") or {}).get("mimeType", "application/octet-stream")}))
    try:
        content, filename, mime = await read_validated_upload(upload)
    except HTTPException as exc:
        raise StorageError("format", str(exc.detail))
    return content, {"item_id": item["id"], "filename": filename, "mime": mime, "size": len(content),
                     "sha256": hashlib.sha256(content).hexdigest(), "etag": item.get("eTag")}


async def execute_remote(session, operation, case, document, attempt):
    if operation.kind == "connect":
        secret = unseal(operation.secrets_cipher)
        tokens = secret.get("tokens")
        if not tokens:
            tokens = await token_request({"grant_type": "authorization_code", "code": secret["code"],
                                         "code_verifier": secret["verifier"], "redirect_uri": settings.MICROSOFT_OAUTH_REDIRECT_URI})
            stored = await StorageOperationRepository(session, operation.firma_id).get_locked(operation.id)
            if stored.status != "running" or stored.attempts != attempt:
                raise StorageError("stale", "La operación ya fue recuperada por otro proceso.")
            stored.secrets_cipher = seal({"tokens": tokens})
            await session.commit()
        client = OneDriveStorageService(tokens["access_token"], "")
        try:
            drive = await client.request("GET", "/me/drive", params={"$select": "id,driveType,owner"})
        finally:
            await client.close()
        if drive.get("driveType") != "personal" or not tokens.get("refresh_token"):
            raise StorageError("account", "Autoriza una cuenta OneDrive personal con acceso renovable.")
        return {"drive": drive, "tokens": tokens}

    client, connection = await connection_client(session, operation)
    try:
        data = operation.payload
        binding = (case.storage_folders or {}).get(f"onedrive:{connection.id}") if case else None
        if operation.kind == "upload":
            if not connection.root_folder_id:
                raise StorageError("root", "Selecciona una carpeta en Ajustes → Almacenamiento.")
            if data.get("target_folder_id"):
                folder_id = data["target_folder_id"]
            elif binding:
                folder_id = binding["root_folder_id"]
            else:
                structure = await client.create_case_folder_structure(case.id.hex)
                folder_id = structure["root_folder_id"]
            folder = await client.get_file_metadata(folder_id)
            if "folder" not in folder:
                raise StorageError("folder", "La carpeta del expediente ya no está disponible.")
            await client.require_descendant(folder, connection.root_folder_id, allow_root=True)
            if not data.get("target_folder_id"):
                stored = await StorageOperationRepository(session, operation.firma_id).get_locked(operation.id)
                if stored.status != "running" or stored.attempts != attempt:
                    raise StorageError("stale", "La operación fue recuperada por otro proceso.")
                stored.payload = {**stored.payload, "target_folder_id": folder_id}
                await session.commit()
            def read_input():
                with transfer_path(operation.firma_id, operation.id).open("rb") as stream:
                    return stream.read(MAX_DOCUMENT_BYTES + 1)
            content = await run_in_threadpool(read_input)
            if len(content) > MAX_DOCUMENT_BYTES or hashlib.sha256(content).hexdigest() != data["sha256"]:
                raise StorageError("integrity", "La carga temporal no coincide con el archivo recibido.")
            name = f"{operation.id.hex}_{Path(data['filename']).stem[:150]}{Path(data['filename']).suffix.lower()}"
            item = await client.named_child(folder_id, name)
            if item is not None:
                previous = await client.read_content(item["id"])
                if hashlib.sha256(previous).hexdigest() != data["sha256"]:
                    raise StorageError("conflict", "Existe otro contenido para esta operación. No se sobrescribió.")
            else:
                item_id, _, _, _ = await client.upload_file(content, name, data["mime"], folder_id)
                item = await client.get_file_metadata(item_id)
            # Verificar también el resultado del proveedor antes de publicar metadatos.
            if int(item.get("size", -1)) != len(content):
                raise StorageError("integrity", "OneDrive no confirmó el tamaño del archivo.")
            return {"item_id": item["id"], "filename": data["filename"], "mime": data["mime"],
                    "size": len(content), "sha256": data["sha256"], "etag": item.get("eTag"), "folder_id": folder_id}

        item_id = document.external_file_id if document else data.get("item_id") or (binding or {}).get("root_folder_id") or connection.root_folder_id or "root"
        item = await client.get_file_metadata(item_id)
        if operation.kind in {"browse", "link", "bind_case"}:
            for_binding = operation.kind == "bind_case" or (operation.kind == "browse" and data.get("for_binding"))
            if case and not connection.root_folder_id:
                raise StorageError("root", "Selecciona una carpeta en Ajustes → Almacenamiento.")
            # El administrador debe poder elegir otra raíz desde toda la cuenta.
            root = ((binding or {}).get("root_folder_id") if not for_binding else connection.root_folder_id) if case else None
            if case and operation.kind in {"browse", "link"} and not binding and not for_binding:
                raise StorageError("case_folder", "Primero asigna la carpeta de OneDrive a este expediente.")
            if root:
                await client.require_descendant(item, root, allow_root=operation.kind != "link")
        if operation.kind in {"root", "bind_case", "browse"} and "folder" not in item:
            raise StorageError("folder", "Selecciona una carpeta.")
        if operation.kind in {"root", "bind_case"}:
            return {"item_id": item["id"], "name": item["name"]}
        if operation.kind == "browse":
            next_link = None
            if data.get("cursor"):
                previous = await StorageOperationRepository(session, operation.firma_id).get_by_id(uuid.UUID(data["cursor"]))
                if (not previous or previous.kind != "browse" or previous.status != "completed"
                        or previous.user_id != operation.user_id or previous.connection_id != operation.connection_id
                        or previous.asunto_id != operation.asunto_id or previous.expires_at <= now()
                        or (previous.result or {}).get("_parent_id") != item["id"]
                        or previous.payload.get("generation") != data["generation"]):
                    raise StorageError("cursor", "La página venció. Actualiza la carpeta.")
                next_link = previous.result.get("_next_link")
                if not next_link:
                    raise StorageError("cursor", "No hay más páginas disponibles.")
                await session.commit()
            page = await client.list_children(item["id"], next_link)
            return {"items": [{"id": entry["id"], "name": entry["name"], "folder": "folder" in entry,
                               "size": int(entry.get("size") or 0)} for entry in page.get("value", [])
                              if not any(key in entry for key in ("remoteItem", "deleted", "package"))],
                    "next_cursor": str(operation.id) if page.get("@odata.nextLink") else None,
                    "_next_link": page.get("@odata.nextLink"), "_parent_id": item["id"]}
        content, metadata = await validate_remote(client, item)
        if operation.kind == "download":
            if not document.content_sha256 or metadata["sha256"] != document.content_sha256:
                raise StorageError("changed", "El archivo cambió en OneDrive. La firma debe revisarlo antes de compartirlo.")
            await save_transfer(operation.firma_id, operation.id, content, "output")
            return {"content_url": f"/api/v1/storage/operations/{operation.id}/content", "mime_type": metadata["mime"],
                    "name": document.nombre_funcional + Path(metadata["filename"]).suffix}
        return metadata
    finally:
        await client.close()


async def apply_result(session, operation, result, case, document, connection):
    if operation.kind == "connect":
        drive, tokens = result["drive"], result["tokens"]
        repo = StorageConnectionRepository(session, operation.firma_id)
        connection = await repo.find_drive("onedrive", drive["id"])
        if connection is None:
            connection = StorageConnection(firma_id=operation.firma_id, provider="onedrive", drive_id=drive["id"],
                                           created_by_id=operation.user_id, generation=1)
        else:
            connection.generation += 1
        connection.is_active = True
        connection.account_name = ((drive.get("owner") or {}).get("user") or {}).get("displayName", "OneDrive personal")
        cipher = StorageTokenCipher()
        connection.access_token_cipher = cipher.encrypt(tokens["access_token"])
        connection.refresh_token_cipher = cipher.encrypt(tokens["refresh_token"])
        from datetime import datetime
        connection.expires_at = datetime.fromisoformat(tokens["expires_at"])
        session.add(connection)
        await session.flush()
        return {"connection_id": str(connection.id)}
    if operation.kind == "root":
        connection.root_folder_id, connection.root_folder_name = result["item_id"], result["name"]
        connection.generation += 1
        operation.payload = {**operation.payload, "generation": connection.generation}
        await FirmaStorageRepository(session, operation.firma_id).stage_destination("onedrive", connection.id)
        return {"connection_id": str(connection.id)}
    if operation.kind in {"bind_case", "upload"}:
        case.storage_folders = {**(case.storage_folders or {}), f"onedrive:{connection.id}": {
            "connection_id": str(connection.id), "root_folder_id": result.get("folder_id") or result["item_id"]}}
        if operation.kind == "bind_case":
            return {"connection_id": str(connection.id)}
    if operation.kind in {"link", "upload", "refresh"}:
        repo = DocumentoRepository(session, operation.firma_id)
        if operation.kind != "refresh":
            previous = await repo.find_remote(case.id, connection.id, result["item_id"])
            if previous:
                raise StorageError("duplicate", "El archivo ya está vinculado a este expediente.")
            step = next((step for step in case.pasos if step.estado == "activo" and step.is_active), None)
            document = await repo.stage_create({"asunto_id": case.id, "asunto_paso_id": step.id if step else None,
                "nombre_funcional": operation.payload["nombre_funcional"], "tipo_documental": operation.payload["tipo_documental"],
                "subcarpeta": folder_for_document_type(operation.payload["tipo_documental"]),
                "provider": "onedrive", "external_file_id": result["item_id"], "web_view_url": "",
                "storage_connection_id": connection.id, "compartido_con_cliente": operation.payload.get("compartido_con_cliente", False)},
                created_by_id=operation.user_id)
            document.web_view_url = f"/api/v1/documentos/{document.id}/preview"
            await NovedadRepository(session, operation.firma_id).stage_create({"asunto_id": case.id,
                "asunto_paso_id": document.asunto_paso_id, "documento_id": document.id, "tipo": "documento_incorporado",
                "titulo": "Documento incorporado", "descripcion": document.nombre_funcional,
                "publicado_al_cliente": document.compartido_con_cliente}, created_by_id=operation.user_id)
        else:
            document.compartido_con_cliente = False
            await NovedadRepository(session, operation.firma_id).stage_document_visibility(document.id, case.id, False)
        document.nombre_original, document.mime_type = result["filename"], result["mime"]
        document.tamano_bytes, document.content_sha256, document.remote_etag = result["size"], result["sha256"], result["etag"]
        operation.documento_id = document.id
        return {"documento_id": str(document.id)}
    return result


async def run_storage_operation(ctx, firma_id: str, operation_id: str):
    factory = ctx.get("session_factory", AsyncSessionLocal)
    firma_id, operation_id = uuid.UUID(firma_id), uuid.UUID(operation_id)
    async with factory() as session:
        repo = StorageOperationRepository(session, firma_id)
        attempt = None
        try:
            await FirmaRepository(session).lock_active(firma_id)
            operation = await repo.get_locked(operation_id)
            if operation and operation.kind == "upload_local":
                return  # La carga local se recupera por la petición, sin lecturas cloud.
            if not operation or operation.status not in {"queued", "running", "awaiting_authorization"}:
                return
            if operation.status in {"queued", "running"} and operation.lease_until and operation.lease_until > now():
                return
            if operation.status == "awaiting_authorization" and operation.expires_at > now():
                return
            if operation.expires_at <= now() or operation.attempts - operation.payload.get("_retry_floor", 0) >= 3:
                raise StorageError("expired", "La operación venció. Inicia una nueva solicitud.")
            _, case, document, _ = await guard(session, operation)
            operation.status, operation.attempts = "running", operation.attempts + 1
            operation.lease_until = now() + timedelta(minutes=5)
            attempt = operation.attempts
            await session.commit()
            result = await execute_remote(session, operation, case, document, attempt)
            await FirmaRepository(session).lock_active(firma_id)
            operation = await repo.get_locked(operation_id)
            if operation.status != "running" or operation.attempts != attempt:
                return
            if operation.expires_at <= now():
                raise StorageError("expired", "La operación venció. Inicia una nueva solicitud.")
            _, case, document, connection = await guard(session, operation)
            operation.result = await apply_result(session, operation, result, case, document, connection)
            operation.status, operation.secrets_cipher, operation.lease_until = "completed", None, None
            operation.error_code = operation.error_message = None
            await session.commit()
        except Exception as exc:
            await session.rollback()
            error = exc if isinstance(exc, StorageError) else StorageError("temporary", "No se pudo completar la operación. Reintenta desde el expediente.", isinstance(exc, (httpx.TransportError, OSError)))
            try:
                await FirmaRepository(session).lock_active(firma_id)
                operation = await repo.get_locked(operation_id)
                if operation and operation.status != "completed" and (attempt is None or operation.attempts == attempt):
                    operation.status = "queued" if error.retryable and operation.attempts - operation.payload.get("_retry_floor", 0) < 3 and operation.expires_at > now() else "failed"
                    operation.error_code, operation.error_message = error.code, error.message
                    operation.lease_until = now() + timedelta(seconds=20 * max(operation.attempts, 1))
                    if operation.status == "failed":
                        operation.secrets_cipher = None
                    await session.commit()
            except Exception:
                await session.rollback()  # La lease permite recuperación tras un fallo de BD.
            logger.warning("storage_operation_failed (%s)", type(exc).__name__, extra={"operation_id": str(operation_id), "category": error.code})


async def dispatch_storage_operations(ctx):
    await ctx["redis"].set(HEARTBEAT, "ready", ex=30)
    factory = ctx.get("session_factory", AsyncSessionLocal)
    async with factory() as session:
        firms = await FirmaRepository(session).list_ids_for_workers()
        await session.commit()
        for firma_id in firms:
            repo = StorageOperationRepository(session, firma_id)
            ready = [(str(op.id), op.attempts) for op in await repo.ready(now())]
            expired = [op.id for op in await repo.expired_transfers(now())]
            await session.commit()
            for operation_id, attempts in ready:
                await ctx["redis"].enqueue_job("run_storage_operation", str(firma_id), operation_id,
                                               _job_id=f"storage:{operation_id}:{attempts}")
            for operation_id in expired:
                await clear_transfers(firma_id, operation_id)
                operation = await repo.get_locked(operation_id)
                if operation:
                    operation.payload = {**operation.payload, "_transfers_cleared": True}
                    operation.secrets_cipher = None
            await session.commit()


class WorkerSettings:
    functions = [run_storage_operation]
    cron_jobs = [cron(dispatch_storage_operations, second=set(range(0, 60, 5)), run_at_startup=True)]
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    job_timeout = 120
    max_jobs = 4
    keep_result = 0
    log_results = False
    handle_signals = os.name != "nt"
