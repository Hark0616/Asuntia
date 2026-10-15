"""Autorización y comandos locales; el HTTP no lee contenido de OneDrive."""
import base64
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import secrets
import uuid
from urllib.parse import urlencode

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.core.access import can_access_asunto
from app.models.storage import StorageOperation
from app.repositories.asunto_repository import AsuntoRepository
from app.repositories.documento_repository import DocumentoRepository
from app.repositories.firma_repository import FirmaRepository
from app.repositories.firma_storage_repository import FirmaStorageRepository
from app.repositories.storage_repository import StorageConnectionRepository, StorageOperationRepository
from app.repositories.user_repository import UserRepository
from app.services.storage.onedrive import StorageError, SCOPES
from app.services.storage.queue import storage_worker_ready
from app.services.storage.token_cipher import StorageTokenCipher


def now():
    return datetime.now(timezone.utc)


def fingerprint(data):
    return hashlib.sha256(json.dumps(data, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def seal(data):
    return StorageTokenCipher().encrypt(json.dumps(data))


def unseal(value):
    return json.loads(StorageTokenCipher().decrypt(value)) if value else {}


async def require_worker():
    if not await storage_worker_ready():
        raise HTTPException(503, "El procesador de archivos no está disponible. Inténtalo más tarde.")


async def lock_actor(session, user):
    """Revalidar la sesión después de esperar una modificación de la firma."""
    revision = user.updated_at.isoformat()
    firma = await FirmaRepository(session).lock_active(user.firma_id)
    current = await UserRepository(session, user.firma_id).get_active_identity(user.id)
    if not firma or not current or current.updated_at.isoformat() != revision:
        raise HTTPException(401, "Sesión inválida o expirada")
    return current


async def guard(session, operation, *, actor=None, revision=True):
    actor_revision = actor.updated_at.isoformat() if actor else None
    firma = await FirmaRepository(session).lock_active(operation.firma_id)
    user = await UserRepository(session, operation.firma_id).get_active_identity(operation.user_id)
    if not firma or not user or (actor and user.id != actor.id):
        raise StorageError("access", "La operación ya no está autorizada.")
    if actor and user.updated_at.isoformat() != actor_revision:
        raise StorageError("access", "La sesión cambió. Inicia una nueva operación.")
    if revision and user.updated_at.isoformat() != operation.user_revision:
        raise StorageError("access", "La sesión cambió. Inicia una nueva operación.")
    if operation.kind in {"connect", "root"} and user.rol != "administrador":
        raise StorageError("access", "Esta operación requiere administración de la firma.")
    if operation.kind == "bind_case" and user.rol not in {"administrador", "auxiliar"}:
        raise StorageError("access", "La carpeta del expediente debe asignarla administración o un auxiliar.")
    if operation.payload.get("for_binding") and user.rol not in {"administrador", "auxiliar"}:
        raise StorageError("access", "Esta consulta de carpetas requiere administración o un auxiliar.")
    if operation.kind != "download" and user.rol == "cliente":
        raise StorageError("access", "La operación ya no está autorizada.")
    case = None
    document = None
    if operation.asunto_id:
        case = await AsuntoRepository(session, operation.firma_id).get_by_id_for_update(operation.asunto_id)
        if not case or not can_access_asunto(user, case):
            raise StorageError("access", "Asunto no encontrado.")
    elif user.rol != "administrador":
        raise StorageError("access", "La operación requiere un expediente autorizado.")
    if operation.documento_id:
        document = await DocumentoRepository(session, operation.firma_id).get_by_id_for_update(operation.documento_id)
        if (not document or not case or document.asunto_id != case.id
                or document.storage_connection_id != operation.connection_id
                or (user.rol == "cliente" and not document.compartido_con_cliente)):
            raise StorageError("access", "Documento no encontrado.")
    if operation.payload.get("compartido_con_cliente") or operation.kind == "refresh":
        if user.rol not in {"administrador", "abogado"}:
            raise StorageError("access", "Solo un abogado o administrador puede publicar al cliente.")
    connection = None
    if operation.connection_id:
        connection = await StorageConnectionRepository(session, operation.firma_id).get_by_id(operation.connection_id)
        if not connection or connection.generation != operation.payload.get("generation"):
            raise StorageError("reconnect", "La conexión cambió. Actualiza y vuelve a intentarlo.")
    return user, case, document, connection


async def create_operation(session, user, id, kind, data, *, connection_id=None,
                           asunto_id=None, documento_id=None, request_hash=None,
                           initial_status="queued", secrets_data=None, prepare=None):
    await lock_actor(session, user)
    repo = StorageOperationRepository(session, user.firma_id)
    existing = await repo.get_locked(id)
    digest = request_hash or fingerprint({"kind": kind, "data": data, "case": str(asunto_id), "document": str(documento_id)})
    if existing:
        if existing.user_id != user.id:
            raise HTTPException(404, "Operación no encontrada")
        if existing.request_hash != digest:
            raise HTTPException(409, "La operación ya se utilizó para otra solicitud.")
        retry = existing.status == "failed" and existing.kind != "connect"
        if retry:
            if existing.expires_at <= now():
                raise HTTPException(410, "La operación venció. Inicia una nueva solicitud.")
            if existing.connection_id:
                connection = await StorageConnectionRepository(session, user.firma_id).get_by_id(existing.connection_id)
                if not connection:
                    raise HTTPException(409, "Reconecta OneDrive antes de reintentar.")
                existing.payload = {**existing.payload, "generation": connection.generation}
        try:
            await guard(session, existing, actor=user, revision=False)
        except StorageError as exc:
            raise HTTPException(404, exc.message)
        if retry:
            await require_worker()
            firm_pending, user_pending = await repo.pending_counts(user.id, now())
            if firm_pending >= 100 or user_pending >= 20:
                raise HTTPException(429, "Hay demasiadas operaciones pendientes. Espera antes de continuar.", headers={"Retry-After": "30"})
            existing.status, existing.user_revision, existing.lease_until = "queued", user.updated_at.isoformat(), None
            existing.payload = {**existing.payload, "_retry_floor": existing.attempts}
            existing.error_code = existing.error_message = None
            await session.commit()
        return existing
    operation = StorageOperation(id=id, firma_id=user.firma_id, kind=kind, payload=dict(data),
                                 user_id=user.id, created_by_id=user.id, user_revision=user.updated_at.isoformat(),
                                 request_hash=digest, connection_id=connection_id, asunto_id=asunto_id,
                                 documento_id=documento_id, expires_at=now() + timedelta(minutes=20))
    if connection_id:
        connection = await StorageConnectionRepository(session, user.firma_id).get_by_id(connection_id)
        if not connection:
            raise HTTPException(404, "Conexión no encontrada")
        operation.payload = {**data, "generation": connection.generation}
    try:
        await guard(session, operation, actor=user)
    except StorageError as exc:
        raise HTTPException(404 if exc.code == "access" else 409, exc.message)
    await require_worker()
    firm_pending, user_pending = await repo.pending_counts(user.id, now())
    if firm_pending >= 100 or user_pending >= 20:
        raise HTTPException(429, "Hay demasiadas operaciones pendientes. Espera antes de continuar.", headers={"Retry-After": "30"})
    if prepare:
        await prepare()
    operation.status = initial_status
    operation.secrets_cipher = seal(secrets_data) if secrets_data else None
    if initial_status == "awaiting_authorization":
        operation.expires_at = now() + timedelta(minutes=10)
    session.add(operation)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        # El ID puede haberse guardado en otra petición; nunca consultar otro tenant.
        existing = await repo.get_by_id(id)
        if not existing or existing.user_id != user.id or existing.request_hash != digest:
            raise HTTPException(409, "Identificador de operación no disponible.")
        return existing
    return operation


async def begin_oauth(session, user):
    if not settings.MICROSOFT_CLIENT_ID or not settings.MICROSOFT_CLIENT_SECRET:
        raise HTTPException(503, "La conexión Microsoft aún no está configurada en el servidor.")
    id = uuid.uuid4()
    verifier, nonce = secrets.token_urlsafe(64), secrets.token_urlsafe(32)
    state_hash = hmac.new(settings.JWT_SECRET.encode(), nonce.encode(), hashlib.sha256).hexdigest()
    operation = await create_operation(session, user, id, "connect", {"state_hash": state_hash},
                                       initial_status="awaiting_authorization", secrets_data={"verifier": verifier})
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    query = {"client_id": settings.MICROSOFT_CLIENT_ID, "redirect_uri": settings.MICROSOFT_OAUTH_REDIRECT_URI,
             "response_type": "code", "response_mode": "query", "scope": SCOPES, "prompt": "select_account",
             "state": f"{id}.{nonce}", "code_challenge": challenge, "code_challenge_method": "S256"}
    return {"authorization_url": "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?" + urlencode(query),
            "operation_id": str(id)}


async def finish_oauth(session, user, params):
    try:
        operation_id, nonce = params.get("state", "").split(".", 1)
        operation_id = uuid.UUID(operation_id)
    except (ValueError, AttributeError):
        raise HTTPException(400, "La autorización no es válida.")
    # Orden de bloqueo firma -> operación, igual que el worker.
    await FirmaRepository(session).lock_active(user.firma_id)
    operation = await StorageOperationRepository(session, user.firma_id).get_locked(operation_id)
    digest = hmac.new(settings.JWT_SECRET.encode(), nonce.encode(), hashlib.sha256).hexdigest()
    if (not operation or operation.user_id != user.id or operation.kind != "connect"
            or operation.status != "awaiting_authorization" or operation.expires_at <= now()
            or not hmac.compare_digest(operation.payload.get("state_hash", ""), digest)):
        raise HTTPException(400, "La autorización venció o ya fue utilizada.")
    try:
        await guard(session, operation, actor=user)
    except StorageError:
        raise HTTPException(400, "La autorización no corresponde a esta sesión.")
    if params.get("error") or not params.get("code"):
        operation.status = "failed"
        operation.secrets_cipher = None
        operation.error_code, operation.error_message = "consent", "No se completó la autorización con Microsoft."
    else:
        operation.secrets_cipher = seal({**unseal(operation.secrets_cipher), "code": params["code"]})
        operation.status = "queued"
    await session.commit()
    return operation
