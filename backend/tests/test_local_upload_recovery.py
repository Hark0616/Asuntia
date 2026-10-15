import asyncio
from datetime import timedelta
import hashlib
from pathlib import Path
import shutil
from unittest.mock import AsyncMock
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.storage import StorageOperation
from app.config import settings
from app.repositories.firma_storage_repository import FirmaStorageRepository
from app.repositories.novedad_repository import NovedadRepository
from app.repositories.storage_repository import StorageOperationRepository
from app.services.storage.local_storage import LocalStorageService
from app.services.storage.operations import now
from app.workers import storage as worker
from tests.conftest import TestingSessionLocal

FIRMA = uuid.UUID("00000000-0000-0000-0000-000000000001")
PDF = b"%PDF-1.4\n% Recoverable local upload\n%%EOF"


@pytest.fixture
async def case(client):
    response = await client.post("/api/v1/asuntos", json={"titulo": "Carga local recuperable",
        "cliente_id": "00000000-0000-0000-0000-000000000020"})
    assert response.status_code == 201, response.text
    return response.json()


async def upload(client, case, id, **changes):
    content = changes.pop("content", PDF)
    filename = changes.pop("filename", "original.pdf")
    return await client.post(f"/api/v1/asuntos/{case['id']}/documentos/upload",
        data={"operation_id": id, "nombre_funcional": "Original recuperable", **changes},
        files={"file": (filename, content, "application/pdf")})


def originals(root, id):
    return list(root.rglob(f"{uuid.UUID(id).hex}.pdf"))


async def documents(client, case):
    return (await client.get(f"/api/v1/asuntos/{case['id']}/documentos")).json()


async def test_replay_has_one_file_document_event_and_private_operation(client, sandra_client, case, isolated_storage_root):
    id = str(uuid.uuid4())
    first = await upload(client, case, id)
    assert first.status_code == 201, first.text
    second = await upload(client, case, id)
    assert second.status_code == 201 and second.json()["id"] == first.json()["id"]
    assert len(await documents(client, case)) == 1 and len(originals(isolated_storage_root, id)) == 1
    events = (await client.get(f"/api/v1/novedades/asunto/{case['id']}")).json()
    assert len([e for e in events if e["documento_id"] == first.json()["id"]]) == 1
    assert first.json()["nombre_original"] == "original.pdf"
    assert first.json()["content_sha256"] == hashlib.sha256(PDF).hexdigest()
    key = first.json()["external_file_id"]
    assert key == f"documentos/{FIRMA.hex}/{uuid.UUID(case['id']).hex}/{uuid.UUID(id).hex}.pdf"
    op = await client.get(f"/api/v1/storage/operations/{id}")
    assert op.status_code == 200 and op.json()["status"] == "completed"
    assert op.json()["result"] == {"documento_id": first.json()["id"]}
    assert key not in op.text
    assert (await sandra_client.get(f"/api/v1/storage/operations/{id}")).status_code == 404
    assert (await sandra_client.post(f"/api/v1/asuntos/{case['id']}/documentos/upload",
        data={"operation_id": id, "nombre_funcional": "Original recuperable"}, files={"file": ("original.pdf", PDF, "application/pdf")})).status_code == 404


async def test_simultaneous_retries_converge_to_one_local_document(client, case, isolated_storage_root):
    id = str(uuid.uuid4())
    responses = await asyncio.gather(upload(client, case, id), upload(client, case, id))
    assert [r.status_code for r in responses] == [201, 201], [r.text for r in responses]
    assert responses[0].json()["id"] == responses[1].json()["id"]
    assert len(await documents(client, case)) == 1 and len(originals(isolated_storage_root, id)) == 1


@pytest.mark.parametrize("change", [{"nombre_funcional": "Otro nombre"}, {"tipo_documental": "poder"},
    {"compartido_con_cliente": "true"}, {"filename": "otro.pdf"}, {"content": b"%PDF-1.4\nother\n%%EOF"}])
async def test_operation_id_cannot_be_reused_for_another_local_request(client, case, change, isolated_storage_root):
    id = str(uuid.uuid4())
    assert (await upload(client, case, id)).status_code == 201
    rejected = await upload(client, case, id, **change)
    assert rejected.status_code == 409, rejected.text
    assert len(await documents(client, case)) == 1
    assert originals(isolated_storage_root, id)[0].read_bytes() == PDF


async def test_failed_intent_commit_writes_nothing_and_can_be_retried(client, case, monkeypatch, isolated_storage_root):
    id = str(uuid.uuid4())
    original = AsyncSession.commit
    async def fail_intent(session):
        if any(isinstance(obj, StorageOperation) and str(obj.id) == id for obj in session.identity_map.values()):
            raise RuntimeError("Synthetic failure before intent commit")
        await original(session)
    with monkeypatch.context() as patch:
        patch.setattr(AsyncSession, "commit", fail_intent)
        response = await upload(client, case, id)
    assert response.status_code == 503, response.text
    assert await documents(client, case) == [] and originals(isolated_storage_root, id) == []
    assert (await upload(client, case, id)).status_code == 201


async def test_file_without_metadata_is_recovered_without_rewrite(client, case, monkeypatch, isolated_storage_root):
    id = str(uuid.uuid4())
    with monkeypatch.context() as patch:
        patch.setattr(NovedadRepository, "stage_create", AsyncMock(side_effect=RuntimeError("Synthetic staging failure")))
        failed = await upload(client, case, id)
    assert failed.status_code == 503 and await documents(client, case) == []
    assert len(originals(isolated_storage_root, id)) == 1
    op = (await client.get(f"/api/v1/storage/operations/{id}")).json()
    assert op["status"] == "failed" and op["result"] is None
    async with TestingSessionLocal() as session:
        assert (await StorageOperationRepository(session, FIRMA).get_by_id(uuid.UUID(id))).attempts == 1
    with monkeypatch.context() as patch:
        patch.setattr("app.services.storage.local_storage.os.replace", lambda *args: pytest.fail("A replay must reuse the verified original"))
        recovered = await upload(client, case, id)
    assert recovered.status_code == 201, recovered.text
    assert len(await documents(client, case)) == 1
    async with TestingSessionLocal() as session:
        assert (await StorageOperationRepository(session, FIRMA).get_by_id(uuid.UUID(id))).attempts == 2


@pytest.mark.parametrize("after_commit", [False, True])
async def test_final_commit_failure_and_lost_acknowledgement_are_recoverable(client, case, monkeypatch, after_commit):
    id = str(uuid.uuid4())
    original, raised = AsyncSession.commit, False
    async def uncertain_commit(session):
        nonlocal raised
        completing = any(isinstance(obj, StorageOperation) and str(obj.id) == id and obj.status == "completed"
                         for obj in session.identity_map.values())
        if completing and not raised:
            raised = True
            if after_commit:
                await original(session)
            raise OSError("Synthetic final commit failure")
        await original(session)
    with monkeypatch.context() as patch:
        patch.setattr(AsyncSession, "commit", uncertain_commit)
        response = await upload(client, case, id)
    assert raised
    assert response.status_code == (201 if after_commit else 503), response.text
    retry = await upload(client, case, id)
    assert retry.status_code == 201 and len(await documents(client, case)) == 1
    if after_commit:
        assert response.json()["id"] == retry.json()["id"]


async def test_interrupted_rename_leaves_retryable_intent_and_no_available_file(client, case, monkeypatch, isolated_storage_root):
    id = str(uuid.uuid4())
    with monkeypatch.context() as patch:
        def interrupt(*args):
            raise OSError("Synthetic interrupted write")
        patch.setattr("app.services.storage.local_storage.os.replace", interrupt)
        failed = await upload(client, case, id)
    assert failed.status_code == 503 and await documents(client, case) == []
    assert originals(isolated_storage_root, id) == []
    assert not list(isolated_storage_root.rglob(f".{uuid.UUID(id).hex}.part"))
    assert (await upload(client, case, id)).status_code == 201


@pytest.mark.parametrize("missing", [False, True])
async def test_replay_does_not_overwrite_or_claim_success_for_damaged_original(client, case, missing):
    id = str(uuid.uuid4())
    first = await upload(client, case, id)
    assert first.status_code == 201
    path = LocalStorageService().contained_path(first.json()["external_file_id"])
    if missing:
        path.unlink()
    else:
        path.write_bytes(b"changed outside Asuntia")
    retry = await upload(client, case, id)
    assert retry.status_code == 409, retry.text
    assert len(await documents(client, case)) == 1
    if not missing:
        assert path.read_bytes() == b"changed outside Asuntia"


async def test_archived_document_is_not_recreated_by_replay(client, case):
    id = str(uuid.uuid4())
    first = await upload(client, case, id)
    assert first.status_code == 201
    assert (await client.delete(f"/api/v1/documentos/{first.json()['id']}")).status_code == 204
    assert (await upload(client, case, id)).status_code == 409
    assert await documents(client, case) == []


async def test_local_recovery_keeps_its_destination_after_switching_to_onedrive(client, case, monkeypatch):
    id = str(uuid.uuid4())
    with monkeypatch.context() as patch:
        patch.setattr(NovedadRepository, "stage_create", AsyncMock(side_effect=RuntimeError("Synthetic failure")))
        assert (await upload(client, case, id)).status_code == 503
    async with TestingSessionLocal() as session:
        await FirmaStorageRepository(session, FIRMA).stage_destination("onedrive")
        await session.commit()
    try:
        result = await upload(client, case, id)
        assert result.status_code == 201 and result.json()["provider"] == "local", result.text
    finally:
        async with TestingSessionLocal() as session:
            await FirmaStorageRepository(session, FIRMA).stage_destination("local")
            await session.commit()


async def test_expired_pending_upload_is_not_recreated_or_sent_to_cloud_worker(client, case, monkeypatch):
    id = str(uuid.uuid4())
    with monkeypatch.context() as patch:
        patch.setattr(LocalStorageService, "write_idempotent", AsyncMock(side_effect=OSError("Synthetic failure")))
        assert (await upload(client, case, id)).status_code == 503
    async with TestingSessionLocal() as session:
        op = await StorageOperationRepository(session, FIRMA).get_locked(uuid.UUID(id))
        op.status = "queued"
        op.expires_at = now() - timedelta(seconds=1)
        await session.commit()
        assert id not in {str(item.id) for item in await StorageOperationRepository(session, FIRMA).ready(now())}
    with monkeypatch.context() as patch:
        remote = AsyncMock(side_effect=AssertionError("Local uploads must not read cloud"))
        patch.setattr(worker, "execute_remote", remote)
        await worker.run_storage_operation({"session_factory": TestingSessionLocal}, str(FIRMA), id)
        remote.assert_not_awaited()
    assert (await upload(client, case, id)).status_code == 410


async def test_local_request_requires_session_case_access_and_valid_uuid(client, anonymous_client, alejandro_client, carlos_client, case):
    id = str(uuid.uuid4())
    assert (await upload(anonymous_client, case, id)).status_code == 401
    assert (await upload(carlos_client, case, id)).status_code == 403
    assert (await upload(alejandro_client, case, id)).status_code == 404
    assert (await upload(client, case, "invalid")).status_code == 422


async def test_relative_key_survives_private_storage_root_move(client, case, tmp_path, monkeypatch):
    id = str(uuid.uuid4())
    first = await upload(client, case, id)
    assert first.status_code == 201
    key = first.json()["external_file_id"]
    new_root = tmp_path / "moved-storage"
    new_path = new_root / key
    new_path.parent.mkdir(parents=True)
    shutil.copy2(LocalStorageService().contained_path(key), new_path)
    monkeypatch.setattr(settings, "LOCAL_STORAGE_PATH", str(new_root))
    replay = await upload(client, case, id)
    assert replay.status_code == 201 and replay.json()["id"] == first.json()["id"]
    preview = await client.get(replay.json()["web_view_url"])
    assert preview.status_code == 200 and preview.content == PDF
    assert list(new_root.rglob("*.pdf")) == [new_path]


async def test_session_revoked_after_intent_does_not_write_original(client, case, monkeypatch, isolated_storage_root):
    id = str(uuid.uuid4())
    original, revoked = AsyncSession.commit, False
    async def revoke_after_intent(session):
        nonlocal revoked
        creating = any(isinstance(obj, StorageOperation) and str(obj.id) == id for obj in session.identity_map.values())
        await original(session)
        if creating and not revoked:
            revoked = True
            assert (await client.post("/api/v1/auth/logout")).status_code == 204
    with monkeypatch.context() as patch:
        patch.setattr(AsyncSession, "commit", revoke_after_intent)
        denied = await upload(client, case, id)
    assert revoked and denied.status_code == 401, denied.text
    assert originals(isolated_storage_root, id) == []
    async with TestingSessionLocal() as session:
        op = await StorageOperationRepository(session, FIRMA).get_by_id(uuid.UUID(id))
        assert op.status == "queued" and op.documento_id is None


async def test_destination_changed_before_firm_lock_does_not_silently_upload_local(client, case, monkeypatch, isolated_storage_root):
    from app.services import local_document_upload
    id = str(uuid.uuid4())
    original = local_document_upload.lock_actor
    switched = False
    async def change_before_lock(session, actor):
        nonlocal switched
        if not switched:
            switched = True
            async with TestingSessionLocal() as other:
                await FirmaStorageRepository(other, FIRMA).stage_destination("onedrive")
                await other.commit()
        return await original(session, actor)
    try:
        with monkeypatch.context() as patch:
            patch.setattr(local_document_upload, "lock_actor", change_before_lock)
            rejected = await upload(client, case, id)
        assert rejected.status_code == 409, rejected.text
        assert originals(isolated_storage_root, id) == []
    finally:
        async with TestingSessionLocal() as session:
            await FirmaStorageRepository(session, FIRMA).stage_destination("local")
            await session.commit()


async def test_recovery_after_process_interruption_reuses_original(client, case, monkeypatch, isolated_storage_root):
    id = str(uuid.uuid4())
    class ProcessInterrupted(BaseException):
        pass
    original = LocalStorageService.write_idempotent
    async def stop_after_write(storage, *args):
        await original(storage, *args)
        raise ProcessInterrupted()
    with monkeypatch.context() as patch:
        patch.setattr(LocalStorageService, "write_idempotent", stop_after_write)
        with pytest.raises(ProcessInterrupted):
            await upload(client, case, id)
    async with TestingSessionLocal() as session:
        op = await StorageOperationRepository(session, FIRMA).get_by_id(uuid.UUID(id))
        assert op.status == "queued" and op.documento_id is None
    assert len(originals(isolated_storage_root, id)) == 1
    assert await documents(client, case) == []
    assert (await upload(client, case, id)).status_code == 201
    assert len(await documents(client, case)) == 1


async def test_another_firm_cannot_replay_read_or_write_the_local_operation(client, anonymous_client, case, db_session):
    from app.models.firma import Firma
    from app.models.user import User
    from app.core.security import create_access_token
    id = str(uuid.uuid4())
    assert (await upload(client, case, id)).status_code == 201
    other = Firma(nombre="Firma aislada de pruebas", subdominio=uuid.uuid4().hex)
    db_session.add(other)
    await db_session.flush()
    user = User(firma_id=other.id, nombre="Administrador de pruebas", email=f"{uuid.uuid4().hex}@example.test",
                cedula=uuid.uuid4().hex, rol="administrador")
    db_session.add(user)
    await db_session.commit()
    token = create_access_token({"sub": str(user.id), "firma_id": str(other.id), "rol": user.rol,
                                 "user_revision": user.updated_at.isoformat()})
    anonymous_client.cookies.set("access_token", token)
    assert (await upload(anonymous_client, case, id)).status_code == 404
    assert (await anonymous_client.get(f"/api/v1/storage/operations/{id}")).status_code == 404
    assert len(await documents(client, case)) == 1


async def test_historical_absolute_reference_remains_readable(client, case, db_session):
    from app.repositories.documento_repository import DocumentoRepository
    key, _, _, size = await LocalStorageService().upload_file(PDF, "historico.pdf", "application/pdf")
    assert Path(key).is_absolute()
    document = await DocumentoRepository(db_session, FIRMA).stage_create({"asunto_id": uuid.UUID(case["id"]),
        "nombre_funcional": "Referencia histórica", "tipo_documental": "otro", "subcarpeta": "anexo",
        "provider": "local", "external_file_id": key, "web_view_url": "", "mime_type": "application/pdf",
        "tamano_bytes": size, "compartido_con_cliente": False},
        created_by_id=uuid.UUID("00000000-0000-0000-0000-000000000010"))
    await db_session.commit()
    preview = await client.get(f"/api/v1/documentos/{document.id}/preview")
    assert preview.status_code == 200 and preview.content == PDF
    assert len(await documents(client, case)) == 1
