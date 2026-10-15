from datetime import timedelta
from urllib.parse import parse_qs, urlsplit
from unittest.mock import AsyncMock
import hashlib
import os
import uuid

import pytest

from app.config import settings
from app.models.storage import StorageConnection
from app.repositories.storage_repository import StorageOperationRepository
from app.repositories.firma_storage_repository import FirmaStorageRepository
from app.services.storage.operations import now
from app.services.storage.token_cipher import StorageTokenCipher
from app.services.storage.onedrive import StorageError
from app.workers import storage as worker
from tests.conftest import TestingSessionLocal

FIRMA = uuid.UUID("00000000-0000-0000-0000-000000000001")
PDF = b"%PDF-1.4\n% Test source\n%%EOF"


@pytest.fixture
def ready(monkeypatch):
    async def yes():
        return True
    monkeypatch.setattr("app.services.storage.operations.storage_worker_ready", yes)
    monkeypatch.setattr("app.api.v1.endpoints.storage.storage_worker_ready", yes)


@pytest.fixture
def drive(monkeypatch):
    class Drive:
        files = {"source": PDF}
        count = 0
        def __init__(self, *args, **kwargs):
            self.drive_id = "personal-drive"
        async def close(self):
            pass
        async def request(self, method, path, **kwargs):
            return {"id": "personal-drive", "driveType": "personal", "owner": {"user": {"displayName": "Firma de prueba"}}}
        async def get_file_metadata(self, id):
            if id in {"root", "case-folder", "account-root"}:
                return {"id": id, "name": id, "folder": {}}
            if id not in self.files:
                raise StorageError("missing", "Archivo ausente")
            return {"id": id, "name": "soporte.pdf", "file": {"mimeType": "application/pdf"},
                    "size": len(self.files[id]), "eTag": hashlib.sha256(self.files[id]).hexdigest()}
        async def require_descendant(self, *args, **kwargs):
            pass
        async def list_children(self, *args):
            return {"value": [{"id": "source", "name": "soporte.pdf", "file": {}, "size": len(PDF)}]}
        async def read_content(self, id):
            return self.files[id]
        async def create_case_folder_structure(self, *args):
            return {"root_folder_id": "case-folder"}
        async def named_child(self, parent, name):
            return await self.get_file_metadata(name) if name in self.files else None
        async def upload_file(self, content, name, mime, parent):
            self.files[name] = content
            type(self).count += 1
            return name, "", None, len(content)
    monkeypatch.setattr(worker, "OneDriveStorageService", Drive)
    return Drive


@pytest.fixture
async def source(client, db_session, ready, drive):
    cipher = StorageTokenCipher()
    connection = StorageConnection(firma_id=FIRMA, provider="onedrive", drive_id=uuid.uuid4().hex,
        account_name="Cuenta de prueba", root_folder_id="account-root", root_folder_name="Expedientes",
        access_token_cipher=cipher.encrypt("synthetic-access"), refresh_token_cipher=cipher.encrypt("synthetic-refresh"),
        expires_at=now() + timedelta(hours=1), generation=1)
    db_session.add(connection)
    await db_session.commit()
    await FirmaStorageRepository(db_session, FIRMA).stage_destination("onedrive", connection.id)
    await db_session.commit()
    case = (await client.post("/api/v1/asuntos", json={"titulo": "Documentos OneDrive", "cliente_id": "00000000-0000-0000-0000-000000000020"})).json()
    yield connection, case
    async with TestingSessionLocal() as cleanup:
        await FirmaStorageRepository(cleanup, FIRMA).stage_destination("local")
        await cleanup.commit()


async def complete(client, operation):
    await worker.run_storage_operation({"session_factory": TestingSessionLocal}, str(FIRMA), operation["id"])
    response = await client.get(f"/api/v1/storage/operations/{operation['id']}")
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["status"] == "completed", (result.get("error_code"), result.get("error_message"))
    return result


async def start(client, **data):
    response = await client.post("/api/v1/storage/operations", json={"operation_id": str(uuid.uuid4()), **data})
    assert response.status_code == 202, response.text
    return response.json()


async def test_browse_link_publish_download_and_revoke(client, carlos_client, elena_client, source):
    connection, case = source
    await complete(client, await start(client, action="bind_case", asunto_id=case["id"], connection_id=str(connection.id), item_id="case-folder"))
    page = await complete(client, await start(client, action="browse", asunto_id=case["id"], connection_id=str(connection.id)))
    assert page["result"]["items"][0]["id"] == "source"
    assert not any(key.startswith("_") for key in page["result"])
    linked = await complete(client, await start(client, action="link", asunto_id=case["id"], connection_id=str(connection.id),
        item_id="source", nombre_funcional="Soporte existente", compartido_con_cliente=True))
    doc_id = linked["result"]["documento_id"]
    public = (await carlos_client.get(f"/api/v1/asuntos/{case['id']}/documentos")).json()
    assert public[0]["id"] == doc_id
    assert "storage_connection_id" not in public[0]
    assert "synthetic" not in str(public)
    queued = await start(carlos_client, action="download", documento_id=doc_id)
    download = await complete(carlos_client, queued)
    path = download["result"]["content_url"]
    response = await carlos_client.get(path)
    assert response.status_code == 200, response.text
    assert response.content == PDF
    assert response.headers["cache-control"] == "private, no-store"
    assert (await elena_client.get(path)).status_code == 404
    await client.patch(f"/api/v1/documentos/{doc_id}/visibilidad", params={"compartido": False})
    assert (await carlos_client.get(path)).status_code == 404


async def test_upload_retry_same_operation_has_one_document_and_remote_file(client, source, drive):
    connection, case = source
    operation_id = str(uuid.uuid4())
    data = {"nombre_funcional": "Carga recuperable", "operation_id": operation_id}
    first = await client.post(f"/api/v1/asuntos/{case['id']}/documentos/upload", data=data,
                              files={"file": ("soporte.pdf", PDF, "application/pdf")})
    assert first.status_code == 202, first.text
    result = await complete(client, first.json())
    retry = await client.post(f"/api/v1/asuntos/{case['id']}/documentos/upload", data=data,
                              files={"file": ("soporte.pdf", PDF, "application/pdf")})
    assert retry.status_code == 202, retry.text
    assert retry.json()["result"] == result["result"]
    assert drive.count == 1
    docs = (await client.get(f"/api/v1/asuntos/{case['id']}/documentos")).json()
    assert len(docs) == 1 and docs[0]["nombre_original"] == "soporte.pdf"


async def bind_source(client, connection, case, shared=False):
    await complete(client, await start(client, action="bind_case", asunto_id=case["id"], connection_id=str(connection.id), item_id="case-folder"))
    result = await complete(client, await start(client, action="link", asunto_id=case["id"], connection_id=str(connection.id),
        item_id="source", nombre_funcional="Original revisado", compartido_con_cliente=shared))
    return result["result"]["documento_id"]


async def test_oauth_pkce_single_use_encrypted_and_bound_to_session(client, ready, drive, monkeypatch):
    monkeypatch.setattr(settings, "MICROSOFT_CLIENT_ID", "synthetic-client-id")
    monkeypatch.setattr(settings, "MICROSOFT_CLIENT_SECRET", "synthetic-client-secret")
    exchange = AsyncMock(return_value={"access_token": "secret-access", "refresh_token": "secret-refresh",
                                       "expires_at": (now() + timedelta(hours=1)).isoformat()})
    monkeypatch.setattr(worker, "token_request", exchange)
    response = await client.post("/api/v1/storage/onedrive/authorize")
    assert response.status_code == 200, response.text
    data = response.json()
    query = parse_qs(urlsplit(data["authorization_url"]).query)
    assert query["code_challenge_method"] == ["S256"]
    assert "synthetic-client-secret" not in response.text
    state = query["state"][0]
    callback = "/api/v1/storage/onedrive/callback"
    assert (await client.get(callback, params={"state": state + "tampered", "code": "secret-code"})).status_code == 400
    accepted = await client.get(callback, params={"state": state, "code": "secret-code"})
    assert accepted.status_code == 307
    assert "secret-code" not in accepted.headers["location"]
    assert accepted.headers["referrer-policy"] == "no-referrer"
    assert (await client.get(callback, params={"state": state, "code": "secret-code"})).status_code == 400
    assert exchange.await_count == 0  # Callback HTTP no intercambia ni lee archivos.
    async with TestingSessionLocal() as session:
        stored = await StorageOperationRepository(session, FIRMA).get_by_id(uuid.UUID(data["operation_id"]))
        assert "secret-code" not in stored.secrets_cipher
        assert "secret-code" not in str(stored.payload)
    result = await complete(client, {"id": data["operation_id"]})
    assert result["result"].keys() == {"connection_id"}
    assert exchange.await_count == 1
    tokens_request = exchange.call_args.args[0]
    assert tokens_request["grant_type"] == "authorization_code"
    import base64
    assert base64.urlsafe_b64encode(hashlib.sha256(tokens_request["code_verifier"].encode()).digest()).rstrip(b"=").decode() == query["code_challenge"][0]
    async with TestingSessionLocal() as session:
        stored = await StorageOperationRepository(session, FIRMA).get_by_id(uuid.UUID(data["operation_id"]))
        assert stored.secrets_cipher is None


async def test_oauth_cancel_and_expiry_do_not_connect(client, ready, monkeypatch):
    monkeypatch.setattr(settings, "MICROSOFT_CLIENT_ID", "id")
    monkeypatch.setattr(settings, "MICROSOFT_CLIENT_SECRET", "secret")
    first = (await client.post("/api/v1/storage/onedrive/authorize")).json()
    state = parse_qs(urlsplit(first["authorization_url"]).query)["state"][0]
    cancelled = await client.get("/api/v1/storage/onedrive/callback", params={"state": state, "error": "access_denied"})
    assert cancelled.status_code == 307
    result = await client.get(f"/api/v1/storage/operations/{first['operation_id']}")
    assert result.json()["status"] == "failed"
    second = (await client.post("/api/v1/storage/onedrive/authorize")).json()
    async with TestingSessionLocal() as session:
        op = await StorageOperationRepository(session, FIRMA).get_locked(uuid.UUID(second["operation_id"]))
        op.expires_at = now() - timedelta(seconds=1)
        await session.commit()
    state = parse_qs(urlsplit(second["authorization_url"]).query)["state"][0]
    assert (await client.get("/api/v1/storage/onedrive/callback", params={"state": state, "code": "code"})).status_code == 400


async def test_configuration_and_worker_are_required_without_false_success(client, monkeypatch):
    monkeypatch.setattr(settings, "MICROSOFT_CLIENT_ID", "")
    assert (await client.post("/api/v1/storage/onedrive/authorize")).status_code == 503
    monkeypatch.setattr(settings, "MICROSOFT_CLIENT_ID", "id")
    monkeypatch.setattr(settings, "MICROSOFT_CLIENT_SECRET", "secret")
    monkeypatch.setattr("app.services.storage.operations.storage_worker_ready", AsyncMock(return_value=False))
    assert (await client.post("/api/v1/storage/onedrive/authorize")).status_code == 503


async def test_roles_and_unknown_operations(anonymous_client, carlos_client, alejandro_client, sandra_client):
    assert (await anonymous_client.get("/api/v1/storage/status")).status_code == 401
    for user in [carlos_client, alejandro_client, sandra_client]:
        assert (await user.get("/api/v1/storage/status")).status_code == 403
        assert (await user.post("/api/v1/storage/onedrive/authorize")).status_code == 403
        assert (await user.get(f"/api/v1/storage/operations/{uuid.uuid4()}")).status_code == 404
    assert (await carlos_client.post("/api/v1/storage/operations", json={"operation_id": str(uuid.uuid4()), "action": "browse"})).status_code == 403


@pytest.mark.parametrize("payload", [{"action": "other"}, {"action": "link"}, {"action": "download"}, {"action": "root"}])
async def test_invalid_operation_input(client, payload):
    response = await client.post("/api/v1/storage/operations", json={"operation_id": str(uuid.uuid4()), **payload})
    assert response.status_code == 422


async def test_private_document_and_case_scope(client, carlos_client, alejandro_client, source):
    connection, case = source
    id = await bind_source(client, connection, case)
    request = {"operation_id": str(uuid.uuid4()), "action": "download", "documento_id": id}
    assert (await carlos_client.post("/api/v1/storage/operations", json=request)).status_code == 404
    assert (await alejandro_client.post("/api/v1/storage/operations", json=request)).status_code == 404
    assert (await alejandro_client.post("/api/v1/storage/operations", json={"operation_id": str(uuid.uuid4()),
        "action": "bind_case", "asunto_id": case["id"], "connection_id": str(connection.id), "item_id": "root"})).status_code == 403


async def test_changed_source_is_blocked_until_review_and_republication(client, carlos_client, source, drive):
    connection, case = source
    id = await bind_source(client, connection, case, shared=True)
    drive.files["source"] = b"%PDF-1.4\n% Modified source\n%%EOF"
    queued = await start(carlos_client, action="download", documento_id=id)
    await worker.run_storage_operation({"session_factory": TestingSessionLocal}, str(FIRMA), queued["id"])
    failed = (await carlos_client.get(f"/api/v1/storage/operations/{queued['id']}")).json()
    assert failed["status"] == "failed" and failed["error_code"] == "changed"
    assert (await carlos_client.get(f"/api/v1/storage/operations/{queued['id']}/content")).status_code == 404
    await complete(client, await start(client, action="refresh", documento_id=id))
    assert (await carlos_client.get(f"/api/v1/asuntos/{case['id']}/documentos")).json() == []
    await client.patch(f"/api/v1/documentos/{id}/visibilidad", params={"compartido": True})
    prepared = await complete(carlos_client, await start(carlos_client, action="download", documento_id=id))
    assert (await carlos_client.get(prepared["result"]["content_url"])).content == drive.files["source"]


async def test_switching_default_preserves_document_connection_and_disconnect_revokes(client, source):
    connection, case = source
    id = await bind_source(client, connection, case)
    assert (await client.post("/api/v1/storage/destination", json={"provider": "local"})).status_code == 200
    prepared = await complete(client, await start(client, action="download", documento_id=id))
    assert (await client.get(prepared["result"]["content_url"])).content == PDF
    assert (await client.post(f"/api/v1/storage/connections/{connection.id}/disconnect")).status_code == 204
    assert (await client.get(prepared["result"]["content_url"])).status_code == 404


async def test_failed_commit_retries_remote_object_without_duplicate(client, source, drive, monkeypatch):
    _, case = source
    operation_id = str(uuid.uuid4())
    data = {"nombre_funcional": "Operación recuperable", "operation_id": operation_id}
    path = f"/api/v1/asuntos/{case['id']}/documentos/upload"
    first = await client.post(path, data=data, files={"file": ("soporte.pdf", PDF, "application/pdf")})
    original = worker.apply_result
    monkeypatch.setattr(worker, "apply_result", AsyncMock(side_effect=RuntimeError("synthetic commit-stage failure")))
    await worker.run_storage_operation({"session_factory": TestingSessionLocal}, str(FIRMA), operation_id)
    assert (await client.get(f"/api/v1/asuntos/{case['id']}/documentos")).json() == []
    monkeypatch.setattr(worker, "apply_result", original)
    second = await client.post(path, data=data, files={"file": ("soporte.pdf", PDF, "application/pdf")})
    assert second.status_code == 202, second.text
    await complete(client, second.json())
    assert drive.count == 1
    assert len((await client.get(f"/api/v1/asuntos/{case['id']}/documentos")).json()) == 1


async def test_duplicate_queue_delivery_respects_provider_backoff(client, source, monkeypatch):
    connection, case = source
    queued = await start(client, action="bind_case", asunto_id=case["id"], connection_id=str(connection.id), item_id="case-folder")
    original = worker.execute_remote
    remote = AsyncMock(side_effect=StorageError("provider", "Proveedor temporalmente ocupado", True))
    monkeypatch.setattr(worker, "execute_remote", remote)
    ctx = {"session_factory": TestingSessionLocal}
    await worker.run_storage_operation(ctx, str(FIRMA), queued["id"])
    await worker.run_storage_operation(ctx, str(FIRMA), queued["id"])
    assert remote.await_count == 1
    monkeypatch.setattr(worker, "execute_remote", original)
    async with TestingSessionLocal() as session:
        operation = await StorageOperationRepository(session, FIRMA).get_locked(uuid.UUID(queued["id"]))
        assert operation.status == "queued" and operation.attempts == 1
        operation.lease_until = now() - timedelta(seconds=1)
        await session.commit()
    await complete(client, queued)


async def test_lost_commit_acknowledgement_preserves_completed_upload(client, source, drive):
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
    from app.models.storage import StorageOperation
    from tests.conftest import engine
    _, case = source
    id = str(uuid.uuid4())
    data = {"operation_id": id, "nombre_funcional": "Confirmación perdida"}
    path = f"/api/v1/asuntos/{case['id']}/documentos/upload"
    queued = await client.post(path, data=data, files={"file": ("a.pdf", PDF, "application/pdf")})
    assert queued.status_code == 202
    lost = False
    class LostAckSession(AsyncSession):
        async def commit(self):
            nonlocal lost
            completing = any(isinstance(obj, StorageOperation) and obj.status == "completed" for obj in self.identity_map.values())
            await super().commit()
            if completing and not lost:
                lost = True
                raise OSError("Synthetic lost acknowledgement after PostgreSQL commit")
    factory = async_sessionmaker(engine, class_=LostAckSession, expire_on_commit=False, autoflush=False)
    await worker.run_storage_operation({"session_factory": factory}, str(FIRMA), id)
    assert lost
    retry = await client.post(path, data=data, files={"file": ("a.pdf", PDF, "application/pdf")})
    assert retry.status_code == 202 and retry.json()["status"] == "completed"
    assert drive.count == 1
    assert len((await client.get(f"/api/v1/asuntos/{case['id']}/documentos")).json()) == 1


async def test_different_content_cannot_reuse_upload_operation(client, source):
    _, case = source
    data = {"nombre_funcional": "Consistencia", "operation_id": str(uuid.uuid4())}
    path = f"/api/v1/asuntos/{case['id']}/documentos/upload"
    assert (await client.post(path, data=data, files={"file": ("a.pdf", PDF, "application/pdf")})).status_code == 202
    changed = await client.post(path, data=data, files={"file": ("a.pdf", b"%PDF-1.4\nchanged\n%%EOF", "application/pdf")})
    assert changed.status_code == 409


async def test_outbox_dispatch_sends_identifiers_only(client, source):
    connection, case = source
    op = await start(client, action="bind_case", asunto_id=case["id"], connection_id=str(connection.id), item_id="case-folder")
    broker = type("Broker", (), {"set": AsyncMock(), "enqueue_job": AsyncMock()})()
    await worker.dispatch_storage_operations({"redis": broker, "session_factory": TestingSessionLocal})
    args = [call.args for call in broker.enqueue_job.call_args_list]
    assert ("run_storage_operation", str(FIRMA), op["id"]) in args
    assert "synthetic-access" not in str(args) and "synthetic-refresh" not in str(args)


async def test_duplicate_link_does_not_duplicate_document_or_event(client, source):
    connection, case = source
    await bind_source(client, connection, case)
    second = await start(client, action="link", asunto_id=case["id"], connection_id=str(connection.id),
        item_id="source", nombre_funcional="Duplicado")
    await worker.run_storage_operation({"session_factory": TestingSessionLocal}, str(FIRMA), second["id"])
    failed = (await client.get(f"/api/v1/storage/operations/{second['id']}")).json()
    assert failed["status"] == "failed" and failed["error_code"] == "duplicate"
    assert len((await client.get(f"/api/v1/asuntos/{case['id']}/documentos")).json()) == 1
    events = (await client.get(f"/api/v1/novedades/asunto/{case['id']}")).json()
    assert len([event for event in events if event["tipo"] == "documento_incorporado"]) == 1


async def test_explicit_retry_recovers_failed_link_without_changing_its_request(client, source, monkeypatch):
    connection, case = source
    await complete(client, await start(client, action="bind_case", asunto_id=case["id"], connection_id=str(connection.id), item_id="case-folder"))
    payload = {"operation_id": str(uuid.uuid4()), "action": "link", "connection_id": str(connection.id),
               "asunto_id": case["id"], "item_id": "source", "nombre_funcional": "Reintento explícito"}
    assert (await client.post("/api/v1/storage/operations", json=payload)).status_code == 202
    original = worker.execute_remote
    monkeypatch.setattr(worker, "execute_remote", AsyncMock(side_effect=StorageError("provider", "Reintenta", False)))
    await worker.run_storage_operation({"session_factory": TestingSessionLocal}, str(FIRMA), payload["operation_id"])
    failed = (await client.get(f"/api/v1/storage/operations/{payload['operation_id']}")).json()
    assert failed["status"] == "failed"
    monkeypatch.setattr(worker, "execute_remote", original)
    retry = await client.post("/api/v1/storage/operations", json=payload)
    assert retry.status_code == 202 and retry.json()["status"] == "queued"
    await complete(client, retry.json())
    assert len((await client.get(f"/api/v1/asuntos/{case['id']}/documentos")).json()) == 1


async def test_missing_remote_file_never_becomes_an_available_document(client, source):
    connection, case = source
    await complete(client, await start(client, action="bind_case", asunto_id=case["id"], connection_id=str(connection.id), item_id="case-folder"))
    second = await start(client, action="link", asunto_id=case["id"], connection_id=str(connection.id),
        item_id="missing", nombre_funcional="Ausente")
    await worker.run_storage_operation({"session_factory": TestingSessionLocal}, str(FIRMA), second["id"])
    failed = (await client.get(f"/api/v1/storage/operations/{second['id']}")).json()
    assert failed["status"] == "failed" and failed["error_code"] == "missing"
    assert (await client.get(f"/api/v1/asuntos/{case['id']}/documentos")).json() == []


async def test_revoked_session_stops_a_queued_upload(client, source, drive):
    _, case = source
    id = str(uuid.uuid4())
    uploaded = await client.post(f"/api/v1/asuntos/{case['id']}/documentos/upload", data={"operation_id": id, "nombre_funcional": "No autorizado"},
        files={"file": ("soporte.pdf", PDF, "application/pdf")})
    assert uploaded.status_code == 202
    assert (await client.post("/api/v1/auth/logout")).status_code == 204
    await worker.run_storage_operation({"session_factory": TestingSessionLocal}, str(FIRMA), id)
    async with TestingSessionLocal() as session:
        operation = await StorageOperationRepository(session, FIRMA).get_by_id(uuid.UUID(id))
        assert operation.status == "failed" and operation.error_code == "access"
    assert drive.count == 0


async def test_expired_download_cannot_reuse_prepared_bytes(client, source):
    connection, case = source
    id = await bind_source(client, connection, case)
    ready = await complete(client, await start(client, action="download", documento_id=id))
    async with TestingSessionLocal() as session:
        op = await StorageOperationRepository(session, FIRMA).get_locked(uuid.UUID(ready["id"]))
        op.expires_at = now() - timedelta(seconds=1)
        await session.commit()
    assert (await client.get(ready["result"]["content_url"])).status_code == 404


async def test_root_selection_completes_and_activates_the_same_connection(client, source):
    connection, _ = source
    selected = await complete(client, await start(client, action="root", connection_id=str(connection.id), item_id="account-root"))
    status = (await client.get("/api/v1/storage/status")).json()
    assert status["provider"] == "onedrive" and status["connection_id"] == str(connection.id)
    assert selected["result"] == {"connection_id": str(connection.id)}
    assert "access_token" not in str(status) and "synthetic-access" not in str(status)


async def test_admin_can_browse_account_to_change_root_but_case_requires_root(client, source, drive):
    from app.repositories.storage_repository import StorageConnectionRepository
    connection, case = source
    ancestry = AsyncMock(side_effect=AssertionError("Account picker must not be limited to previous root"))
    drive.require_descendant = ancestry
    await complete(client, await start(client, action="browse", connection_id=str(connection.id), item_id="root"))
    ancestry.assert_not_awaited()
    async with TestingSessionLocal() as session:
        stored = await StorageConnectionRepository(session, FIRMA).get_locked(connection.id)
        stored.root_folder_id = None
        await session.commit()
    denied = await start(client, action="bind_case", connection_id=str(connection.id), asunto_id=case["id"], item_id="case-folder")
    await worker.run_storage_operation({"session_factory": TestingSessionLocal}, str(FIRMA), denied["id"])
    response = (await client.get(f"/api/v1/storage/operations/{denied['id']}")).json()
    assert response["status"] == "failed" and response["error_code"] == "root"


async def test_other_firm_connection_is_unavailable(client, source, db_session):
    from app.models.firma import Firma
    other = Firma(nombre="Otra firma", subdominio=uuid.uuid4().hex)
    db_session.add(other)
    await db_session.flush()
    connection = StorageConnection(firma_id=other.id, provider="onedrive", drive_id=uuid.uuid4().hex,
                                   root_folder_id="private-root", generation=1)
    db_session.add(connection)
    await db_session.commit()
    command = {"operation_id": str(uuid.uuid4()), "action": "browse", "connection_id": str(connection.id)}
    assert (await client.post("/api/v1/storage/operations", json=command)).status_code == 404
    assert (await client.post(f"/api/v1/storage/connections/{connection.id}/disconnect")).status_code == 404
    assert (await client.post("/api/v1/storage/destination", json={"provider": "onedrive", "connection_id": str(connection.id)})).status_code == 409
    status = (await client.get("/api/v1/storage/status")).json()
    assert str(connection.id) not in str(status)


async def test_expired_access_token_refreshes_without_changing_document_identity(client, source, monkeypatch):
    from app.repositories.storage_repository import StorageConnectionRepository
    connection, case = source
    async with TestingSessionLocal() as session:
        stored = await StorageConnectionRepository(session, FIRMA).get_locked(connection.id)
        stored.expires_at = now() - timedelta(seconds=1)
        await session.commit()
    refresh = AsyncMock(return_value={"access_token": "rotated-access", "refresh_token": "rotated-refresh",
                                      "expires_at": (now() + timedelta(hours=1)).isoformat()})
    monkeypatch.setattr(worker, "token_request", refresh)
    await complete(client, await start(client, action="bind_case", asunto_id=case["id"], connection_id=str(connection.id), item_id="case-folder"))
    refresh.assert_awaited_once()
    assert refresh.call_args.args[0] == {"grant_type": "refresh_token", "refresh_token": "synthetic-refresh"}
    async with TestingSessionLocal() as session:
        stored = await StorageConnectionRepository(session, FIRMA).get_by_id(connection.id)
        assert stored.generation == 1
        assert StorageTokenCipher().decrypt(stored.access_token_cipher) == "rotated-access"
        assert StorageTokenCipher().decrypt(stored.refresh_token_cipher) == "rotated-refresh"


async def test_stale_admin_cannot_change_storage_after_waiting_for_firm_lock(client, source, db_session):
    from types import SimpleNamespace
    from fastapi import HTTPException
    from app.api.v1.endpoints.storage import destination
    from app.repositories.user_repository import UserRepository
    from app.schemas.storage import StorageDestinationUpdate
    administrator = await UserRepository(db_session, FIRMA).get_active_identity(uuid.UUID("00000000-0000-0000-0000-000000000010"))
    assert administrator is not None
    stale = SimpleNamespace(id=administrator.id, firma_id=FIRMA, updated_at=administrator.updated_at - timedelta(seconds=1))
    with pytest.raises(HTTPException) as rejected:
        await destination(StorageDestinationUpdate(provider="local"), db_session, stale)
    assert rejected.value.status_code == 401
    assert (await FirmaStorageRepository(db_session, FIRMA).get_config()).provider == "onedrive"


@pytest.mark.parametrize("redirect", ["https://user:password@example.test/callback", "https://example.test/callback?code=secret", "javascript:invalid", "https://example.test/callback#secret"])
def test_microsoft_callback_rejects_unsafe_config_without_echoing_values(redirect):
    from app.config import Settings
    from pydantic import ValidationError
    with pytest.raises(ValidationError) as rejected:
        Settings(_env_file=None, MICROSOFT_OAUTH_REDIRECT_URI=redirect)
    assert redirect not in str(rejected.value)


@pytest.mark.skipif(not os.getenv("ASUNTIA_TEST_REDIS_URL"), reason="Redis de integración disponible en CI")
async def test_real_redis_and_arq_execute_persisted_operation(client, source, monkeypatch):
    from arq.connections import create_pool, RedisSettings
    from arq.worker import Worker
    from app.services.storage.queue import storage_worker_ready
    connection, case = source
    queued = await start(client, action="bind_case", connection_id=str(connection.id), asunto_id=case["id"], item_id="case-folder")
    redis_url = os.environ["ASUNTIA_TEST_REDIS_URL"]
    monkeypatch.setattr(settings, "REDIS_URL", redis_url)
    queue_name = f"asuntia:test:{uuid.uuid4().hex}"
    pool = await create_pool(RedisSettings.from_dsn(redis_url), default_queue_name=queue_name)
    runner = Worker(worker.WorkerSettings.functions, redis_pool=pool, queue_name=queue_name,
        burst=True, handle_signals=False, keep_result=0, log_results=False,
        ctx={"session_factory": TestingSessionLocal})
    try:
        await worker.dispatch_storage_operations({"redis": pool, "session_factory": TestingSessionLocal})
        assert await storage_worker_ready()
        await runner.async_run()
        assert runner.jobs_failed == 0
        result = await client.get(f"/api/v1/storage/operations/{queued['id']}")
        assert result.status_code == 200 and result.json()["status"] == "completed"
    finally:
        await runner.close()
