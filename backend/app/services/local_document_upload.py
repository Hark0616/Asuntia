"""Carga local recuperable: intención durable antes del archivo, resultado atómico."""
from datetime import timedelta
import hashlib
import logging
from pathlib import Path
from types import SimpleNamespace
import uuid

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.core.access import can_access_asunto, require_publication_permission
from app.core.document_policy import folder_for_document_type
from app.repositories.asunto_repository import AsuntoRepository
from app.repositories.documento_repository import DocumentoRepository
from app.repositories.firma_storage_repository import FirmaStorageRepository
from app.repositories.novedad_repository import NovedadRepository
from app.repositories.storage_repository import StorageOperationRepository
from app.services.storage.local_storage import LocalStorageService
from app.services.storage.onedrive import StorageError
from app.services.storage.operations import fingerprint, lock_actor, now

logger = logging.getLogger(__name__)


class LocalDocumentUpload:
    def __init__(self, session, user):
        self.session = session
        self.user = SimpleNamespace(id=user.id, firma_id=user.firma_id, updated_at=user.updated_at)
        self.firma_id, self.user_id = user.firma_id, user.id
        self.repo = StorageOperationRepository(session, self.firma_id)
        self.documents = DocumentoRepository(session, self.firma_id)
        self.storage = LocalStorageService()

    async def authorize(self, asunto_id, shared):
        user = await lock_actor(self.session, self.user)
        if user.rol not in {"administrador", "abogado", "auxiliar"}:
            raise HTTPException(403, "Acceso de oficina requerido")
        case = await AsuntoRepository(self.session, self.firma_id).get_by_id_for_update(asunto_id)
        if not case or not can_access_asunto(user, case):
            raise HTTPException(404, "Asunto no encontrado")
        if shared:
            require_publication_permission(user)
        return case

    async def existing_document(self, operation):
        if operation.status != "completed":
            return None
        document = await self.documents.get_by_id(operation.documento_id)
        if not document or document.asunto_id != operation.asunto_id:
            raise HTTPException(409, "El documento de esta operación está archivado o no está disponible.")
        await self.storage.verify_content(document.external_file_id, document.content_sha256)
        return document

    async def upload(self, asunto_id, operation_id, content, filename, mime, name, tipo, shared):
        operation_id = operation_id or uuid.uuid4()
        data = {"filename": filename, "mime": mime, "sha256": hashlib.sha256(content).hexdigest(),
                "nombre_funcional": name, "tipo_documental": tipo, "compartido_con_cliente": shared}
        digest = fingerprint({"kind": "upload_local", "case": str(asunto_id), **data})
        # No se conservan objetos ORM tras un rollback; solo identificadores y
        # valores de sesión para poder consultar la confirmación verdadera.
        revision = self.user.updated_at.isoformat()
        durable = False
        attempted = False
        try:
            await self.authorize(asunto_id, shared)
            operation = await self.repo.get_locked(operation_id)
            if operation:
                if operation.user_id != self.user_id:
                    raise HTTPException(404, "Operación no encontrada")
                if operation.kind != "upload_local" or operation.request_hash != digest:
                    raise HTTPException(409, "La operación ya se utilizó para otra solicitud.")
                durable = True
                document = await self.existing_document(operation)
                if document:
                    return document
                if operation.expires_at <= now():
                    raise HTTPException(410, "La operación venció. Inicia una nueva carga.")
            else:
                config = await FirmaStorageRepository(self.session, self.firma_id).get_config(fresh=True)
                if config and (config.provider != "local" or not config.is_active):
                    raise HTTPException(409, "El destino de nuevas cargas cambió. Actualiza el expediente.")
                firm_pending, user_pending = await self.repo.pending_counts(self.user_id, now())
                if firm_pending >= 100 or user_pending >= 20:
                    raise HTTPException(429, "Hay demasiadas operaciones pendientes. Espera antes de continuar.", headers={"Retry-After": "30"})
                # Clave relativa y opaca: la raíz privada se puede trasladar sin
                # reinterpretar el nombre del usuario ni la ubicación histórica.
                key = (Path("documentos") / self.firma_id.hex / asunto_id.hex /
                       f"{operation_id.hex}{Path(filename).suffix.lower()}").as_posix()
                operation = await self.repo.stage_create({"id": operation_id,
                    "kind": "upload_local", "status": "queued", "asunto_id": asunto_id,
                    "user_id": self.user_id, "user_revision": revision,
                    "request_hash": digest, "payload": {**data, "_key": key},
                    "expires_at": now() + timedelta(hours=24)}, created_by_id=self.user_id)
                # Si esta confirmación falla, todavía no se ha escrito ningún archivo.
                await self.session.commit()
                durable = True

            # La intención puede sobrevivir a reinicios y a un cambio del destino.
            # Volver a comprobar identidad y asunto antes de escribir el original.
            case = await self.authorize(asunto_id, shared)
            operation = await self.repo.get_locked(operation_id)
            document = await self.existing_document(operation)
            if document:
                return document
            operation.status, operation.attempts = "running", operation.attempts + 1
            attempted = True
            await self.storage.write_idempotent(content, operation.payload["_key"])
            active_step = next((step for step in case.pasos if step.estado == "activo" and step.is_active), None)
            document = await self.documents.stage_create({"asunto_id": asunto_id,
                "asunto_paso_id": active_step.id if active_step else None,
                "nombre_funcional": name, "tipo_documental": tipo, "subcarpeta": folder_for_document_type(tipo),
                "provider": "local", "external_file_id": operation.payload["_key"], "web_view_url": "",
                "mime_type": mime, "nombre_original": filename, "content_sha256": data["sha256"],
                "tamano_bytes": len(content), "compartido_con_cliente": shared, "estado_revision": "recibido"},
                created_by_id=self.user_id)
            document.web_view_url = f"/api/v1/documentos/{document.id}/preview"
            document.web_download_url = document.web_view_url
            await NovedadRepository(self.session, self.firma_id).stage_create({
                "asunto_id": asunto_id, "asunto_paso_id": document.asunto_paso_id, "documento_id": document.id,
                "tipo": "documento_incorporado", "titulo": "Documento incorporado", "descripcion": name,
                "publicado_al_cliente": shared}, created_by_id=self.user_id)
            operation.documento_id, operation.result = document.id, {"documento_id": str(document.id)}
            operation.status = "completed"
            operation.error_code = operation.error_message = None
            await self.session.commit()
            return document
        except HTTPException:
            raise
        except Exception as exc:
            await self.session.rollback()
            # Reconocer también el commit cuya confirmación se perdió. No borrar
            # un original que podría estar referenciado por una transacción firme.
            try:
                await self.authorize(asunto_id, shared)
                operation = await self.repo.get_locked(operation_id)
                if operation and operation.kind == "upload_local" and operation.user_id == self.user_id:
                    document = await self.existing_document(operation)
                    if document:
                        return document
                    if durable:
                        if attempted:
                            operation.attempts += 1
                        operation.status = "failed"
                        operation.error_code = exc.code if isinstance(exc, StorageError) else "temporary"
                        operation.error_message = exc.message if isinstance(exc, StorageError) else "No se pudo guardar el archivo. Reintenta la misma carga."
                        await self.session.commit()
            except HTTPException:
                raise
            except Exception:
                await self.session.rollback()
            logger.warning("local_upload_failed (%s)", type(exc).__name__, extra={"operation_id": str(operation_id)})
            raise HTTPException(409 if isinstance(exc, (StorageError, IntegrityError)) else 503,
                exc.message if isinstance(exc, StorageError) else "No se pudo confirmar la carga. Reintenta con el mismo archivo y datos.")
