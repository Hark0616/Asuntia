"""HTTP crea y consulta trabajos; toda lectura Microsoft ocurre en ARQ."""
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.access import can_access_asunto
from app.core.db import get_db
from app.core.deps import get_current_user, require_admin_user, require_office_user
from app.core.document_policy import INLINE_DOCUMENT_TYPES
from app.models.documento import TipoDocumental
from app.models.user import User
from app.repositories.asunto_repository import AsuntoRepository
from app.repositories.documento_repository import DocumentoRepository
from app.repositories.firma_repository import FirmaRepository
from app.repositories.firma_storage_repository import FirmaStorageRepository
from app.repositories.storage_repository import StorageConnectionRepository, StorageOperationRepository
from app.schemas.storage import (StorageCommand, StorageDestinationUpdate, StorageOperationResponse,
                                 StorageStatusResponse)
from app.services.document_upload import read_validated_upload
from app.services.storage.onedrive import StorageError
from app.services.storage.operations import begin_oauth, create_operation, fingerprint, finish_oauth, guard, lock_actor, now
from app.services.storage.queue import storage_worker_ready
from app.services.storage.transfers import save_transfer, transfer_path

router = APIRouter()


def operation_response(operation):
    response = StorageOperationResponse.model_validate(operation)
    if response.result:
        response.result = {key: value for key, value in response.result.items() if not key.startswith("_")}
    return response


@router.get("/storage/status", response_model=StorageStatusResponse)
async def storage_status(db: AsyncSession = Depends(get_db), user: User = Depends(require_admin_user)):
    config = await FirmaStorageRepository(db, user.firma_id).get_config()
    connections = await StorageConnectionRepository(db, user.firma_id).list_connections()
    return {"provider": config.provider if config else "local", "connection_id": config.connection_id if config else None,
            "configured": bool(settings.MICROSOFT_CLIENT_ID and settings.MICROSOFT_CLIENT_SECRET),
            "worker_ready": await storage_worker_ready(), "connections": connections}


@router.post("/storage/destination", response_model=StorageStatusResponse)
async def destination(payload: StorageDestinationUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_admin_user)):
    await lock_actor(db, user)
    if payload.provider == "onedrive":
        connection = await StorageConnectionRepository(db, user.firma_id).get_by_id(payload.connection_id)
        if not connection or not connection.root_folder_id:
            raise HTTPException(409, "Conecta OneDrive y selecciona una carpeta antes de activarlo.")
    await FirmaStorageRepository(db, user.firma_id).stage_destination(payload.provider,
        payload.connection_id if payload.provider == "onedrive" else None)
    await db.commit()
    return await storage_status(db, user)


@router.post("/storage/onedrive/authorize")
async def authorize(db: AsyncSession = Depends(get_db), user: User = Depends(require_admin_user)):
    return await begin_oauth(db, user)


@router.get("/storage/onedrive/callback")
async def callback(request: Request, db: AsyncSession = Depends(get_db), user: User = Depends(require_admin_user)):
    operation = await finish_oauth(db, user, getattr(request.state, "storage_oauth", {}))
    return RedirectResponse(f"{settings.FRONTEND_URL}/oficina/ajustes/almacenamiento?operation={operation.id}",
                            headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"})


@router.post("/storage/connections/{connection_id}/disconnect", status_code=204)
async def disconnect(connection_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(require_admin_user)):
    await lock_actor(db, user)
    connection = await StorageConnectionRepository(db, user.firma_id).get_locked(connection_id, include_inactive=True)
    if not connection:
        raise HTTPException(404, "Conexión no encontrada")
    connection.is_active = False
    connection.generation += 1
    connection.access_token_cipher = connection.refresh_token_cipher = None
    await db.commit()


@router.get("/asuntos/{asunto_id}/documentos/destination")
async def case_destination(asunto_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(require_office_user)):
    case = await AsuntoRepository(db, user.firma_id).get_by_id(asunto_id)
    if not case or not can_access_asunto(user, case):
        raise HTTPException(404, "Asunto no encontrado")
    config = await FirmaStorageRepository(db, user.firma_id).get_config()
    connection = await StorageConnectionRepository(db, user.firma_id).get_by_id(config.connection_id) if config and config.connection_id else None
    binding = (case.storage_folders or {}).get(f"onedrive:{connection.id}") if connection else None
    return {"provider": config.provider if config else "local", "connection_id": str(connection.id) if connection else None,
            "folder_id": (binding or {}).get("root_folder_id"), "root_folder_id": connection.root_folder_id if connection and user.rol in {"administrador", "auxiliar"} else None,
            "can_bind": user.rol in {"administrador", "auxiliar"}}


@router.post("/storage/operations", response_model=StorageOperationResponse, status_code=202)
async def command(payload: StorageCommand, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    if user.rol == "cliente" and payload.action != "download":
        raise HTTPException(403, "Acceso de oficina requerido")
    if payload.action == "root" and user.rol != "administrador":
        raise HTTPException(403, "Acceso de administración requerido")
    if payload.action == "bind_case" and user.rol not in {"administrador", "auxiliar"}:
        raise HTTPException(403, "La carpeta debe asignarla administración o un auxiliar.")
    if payload.action == "root" and not payload.item_id:
        raise HTTPException(422, "Selecciona una carpeta.")
    if payload.action in {"link", "bind_case"} and (not payload.asunto_id or not payload.item_id):
        raise HTTPException(422, "Indica expediente y elemento de OneDrive.")
    if payload.action == "link" and not (payload.nombre_funcional or "").strip():
        raise HTTPException(422, "Indica el nombre del documento.")
    if payload.action in {"download", "refresh"}:
        if not payload.documento_id:
            raise HTTPException(422, "Indica el documento.")
        document = await DocumentoRepository(db, user.firma_id).get_by_id(payload.documento_id)
        if not document or document.provider != "onedrive" or not document.storage_connection_id:
            raise HTTPException(404, "Documento no encontrado")
        payload.asunto_id, payload.connection_id = document.asunto_id, document.storage_connection_id
    if not payload.connection_id:
        raise HTTPException(422, "Indica una conexión.")
    if not payload.asunto_id and user.rol != "administrador":
        raise HTTPException(403, "La consulta requiere un expediente autorizado.")
    digest = fingerprint(payload.model_dump(mode="json", exclude={"operation_id"}))
    data = payload.model_dump(mode="json", exclude={"operation_id", "connection_id", "asunto_id", "documento_id", "action"})
    if data.get("nombre_funcional"):
        data["nombre_funcional"] = data["nombre_funcional"].strip()
    operation = await create_operation(db, user, payload.operation_id, payload.action, data,
        connection_id=payload.connection_id, asunto_id=payload.asunto_id, documento_id=payload.documento_id, request_hash=digest)
    return operation_response(operation)


@router.post("/asuntos/{asunto_id}/documentos/onedrive-upload", response_model=StorageOperationResponse, status_code=202)
async def remote_upload(asunto_id: uuid.UUID, operation_id: uuid.UUID = Form(...),
                        nombre_funcional: str = Form(..., min_length=1, max_length=255),
                        tipo_documental: TipoDocumental = Form(TipoDocumental.OTRO),
                        compartido_con_cliente: bool = Form(False), file: UploadFile = File(...),
                        db: AsyncSession = Depends(get_db), user: User = Depends(require_office_user)):
    import hashlib
    name = nombre_funcional.strip()
    if not name:
        raise HTTPException(422, "Indica el nombre del documento.")
    case = await AsuntoRepository(db, user.firma_id).get_by_id(asunto_id)
    if not case or not can_access_asunto(user, case):
        raise HTTPException(404, "Asunto no encontrado")
    content, filename, mime = await read_validated_upload(file)
    data = {"filename": filename, "mime": mime, "sha256": hashlib.sha256(content).hexdigest(),
            "nombre_funcional": name, "tipo_documental": tipo_documental.value, "compartido_con_cliente": compartido_con_cliente}
    digest = fingerprint({"case": str(asunto_id), **data})
    existing = await StorageOperationRepository(db, user.firma_id).get_by_id(operation_id)
    config = await FirmaStorageRepository(db, user.firma_id).get_config()
    connection_id = existing.connection_id if existing and existing.user_id == user.id else (config.connection_id if config and config.provider == "onedrive" else None)
    if not connection_id:
        raise HTTPException(409, "OneDrive no es el destino de nuevas cargas. Actualiza el expediente.")
    # El archivo temporal es recuperable por UUID si se pierde la respuesta del commit.
    # La cola solo verá la operación después de terminar esta escritura acotada.
    operation = await create_operation(db, user, operation_id, "upload", data, connection_id=connection_id,
        asunto_id=asunto_id, request_hash=digest, prepare=lambda: save_transfer(user.firma_id, operation_id, content))
    return operation_response(operation)


async def accessible_operation(db, user, id):
    operation = await StorageOperationRepository(db, user.firma_id).get_by_id(id)
    if not operation or operation.user_id != user.id:
        raise HTTPException(404, "Operación no encontrada")
    try:
        await guard(db, operation, actor=user, revision=False)
    except StorageError as exc:
        raise HTTPException(404, exc.message)
    return operation


@router.get("/storage/operations/{id}", response_model=StorageOperationResponse)
async def operation_status(id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    operation = await accessible_operation(db, user, id)
    if operation.expires_at <= now() and operation.status != "completed":
        raise HTTPException(410, "La operación venció. Inicia una nueva solicitud.")
    return operation_response(operation)


@router.get("/storage/operations/{id}/content")
async def operation_content(id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    operation = await accessible_operation(db, user, id)
    if operation.kind != "download" or operation.status != "completed" or operation.expires_at <= now():
        raise HTTPException(404, "La descarga no está disponible. Solicítala de nuevo.")
    path = transfer_path(user.firma_id, operation.id, "output")
    if not path.is_file():
        raise HTTPException(404, "La descarga no está disponible. Solicítala de nuevo.")
    result = operation.result
    mime = result["mime_type"]
    return FileResponse(path, media_type=mime, filename=result["name"],
        content_disposition_type="inline" if mime in INLINE_DOCUMENT_TYPES else "attachment",
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
                 "Content-Security-Policy": "sandbox; default-src 'none'; frame-ancestors 'self' " + " ".join(settings.allow_origins_list)})
