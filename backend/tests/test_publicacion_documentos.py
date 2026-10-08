import uuid

import pytest
from sqlalchemy import select, update

from app.models.documento import DocumentoAsunto
from app.models.novedad import Novedad
from app.repositories.novedad_repository import NovedadRepository


CARLOS_ID = "00000000-0000-0000-0000-000000000020"
ALEJANDRO_ID = "00000000-0000-0000-0000-000000000011"
PUBLIC_DOCUMENT_FIELDS = {
    "id", "nombre_funcional", "tipo_documental", "subcarpeta", "provider",
    "web_view_url", "mime_type", "compartido_con_cliente", "created_at",
}


async def create_case(client, **extra):
    response = await client.post(
        "/api/v1/asuntos", json={"cliente_id": CARLOS_ID, **extra}
    )
    assert response.status_code == 201, response.text
    return response.json()


async def link_document(client, case_id, shared=False):
    response = await client.post(
        f"/api/v1/asuntos/{case_id}/documentos/vincular",
        json={
            "nombre_funcional": "Acta de seguimiento",
            "external_file_id": uuid.uuid4().hex,
            "web_view_url": "https://drive.google.com/test",
            "compartido_con_cliente": shared,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def document_events(client, case_id, doc_id):
    response = await client.get(f"/api/v1/novedades/asunto/{case_id}")
    assert response.status_code == 200
    return [item for item in response.json() if item["documento_id"] == doc_id and item["tipo"] == "documento_incorporado"]


@pytest.mark.asyncio
async def test_derived_document_event_is_managed_only_from_its_document(
    client, alejandro_client, carlos_client
):
    case = await create_case(client)
    document = await link_document(client, case["id"], shared=True)
    event = (await document_events(client, case["id"], document["id"]))[0]
    event_path = f"/api/v1/novedades/{event['id']}"
    # La pertenencia se comprueba antes de revelar que es un evento derivado.
    assert (await alejandro_client.delete(event_path)).status_code == 404
    blocked = await client.delete(event_path)
    assert blocked.status_code == 409
    assert blocked.json()["detail"] == "Este avance se gestiona desde su actuación de origen."

    visibility = f"/api/v1/documentos/{document['id']}/visibilidad"
    assert (await client.patch(visibility, params={"compartido": "false"})).status_code == 200
    assert (await carlos_client.get(f"/api/v1/novedades/asunto/{case['id']}")).json() == []
    assert (await client.patch(visibility, params={"compartido": "true"})).status_code == 200
    events = await document_events(client, case["id"], document["id"])
    assert len(events) == 1
    assert events[0]["id"] == event["id"]
    public = await carlos_client.get(f"/api/v1/novedades/asunto/{case['id']}")
    assert [item["id"] for item in public.json()] == [event["id"]]

    note = await client.post(
        f"/api/v1/novedades/asunto/{case['id']}",
        json={"titulo": "Nota independiente", "descripcion": "Registro manual interno."},
    )
    assert note.status_code == 201
    assert (await client.delete(f"/api/v1/novedades/{note.json()['id']}")).status_code == 204
    assert (await client.delete(f"/api/v1/documentos/{document['id']}")).status_code == 204
    assert await document_events(client, case["id"], document["id"]) == []
    assert (await carlos_client.get(f"/api/v1/novedades/asunto/{case['id']}")).json() == []


@pytest.mark.asyncio
async def test_share_revoke_and_archive_document_keep_one_coherent_event(
    client, carlos_client, db_session
):
    case = await create_case(client)
    document = await link_document(client, case["id"])
    events = await document_events(client, case["id"], document["id"])
    assert len(events) == 1
    event_id = events[0]["id"]
    original_created_at = events[0]["created_at"]
    independent = await client.post(
        f"/api/v1/novedades/asunto/{case['id']}",
        json={"titulo": "Nota independiente", "descripcion": "La firma revisó el asunto.", "publicado_al_cliente": True},
    )
    note_id = independent.json()["id"]
    endpoint = f"/api/v1/documentos/{document['id']}/visibilidad"
    for _ in range(2):
        shared = await client.patch(endpoint, params={"compartido": "true"})
        assert shared.status_code == 200
        assert shared.json()["compartido_con_cliente"] is True
    events = await document_events(client, case["id"], document["id"])
    assert len(events) == 1
    assert events[0]["id"] == event_id
    assert events[0]["created_at"] == original_created_at
    assert events[0]["publicado_al_cliente"] is True
    public = await carlos_client.get(f"/api/v1/novedades/asunto/{case['id']}")
    assert {event["id"] for event in public.json()} == {event_id, note_id}
    documents = await carlos_client.get(f"/api/v1/asuntos/{case['id']}/documentos")
    assert document["id"] in {item["id"] for item in documents.json()}
    assert set(documents.json()[0]) == PUBLIC_DOCUMENT_FIELDS

    for _ in range(2):
        revoked = await client.patch(endpoint, params={"compartido": "false"})
        assert revoked.status_code == 200
    assert (await document_events(client, case["id"], document["id"]))[0]["publicado_al_cliente"] is False
    public = await carlos_client.get(f"/api/v1/asuntos/{case['radicado']}")
    assert {event["id"] for event in public.json()["novedades"]} == {note_id}
    assert public.json()["ultima_novedad_at"] == independent.json()["created_at"]
    assert (await carlos_client.get(f"/api/v1/asuntos/{case['id']}/documentos")).json() == []
    assert (await carlos_client.get(f"/api/v1/documentos/{document['id']}/preview")).status_code == 404

    assert (await client.patch(endpoint, params={"compartido": "true"})).status_code == 200
    assert (await client.delete(f"/api/v1/documentos/{document['id']}")).status_code == 204
    assert (await client.delete(f"/api/v1/documentos/{document['id']}")).status_code == 404
    assert (await client.patch(endpoint, params={"compartido": "true"})).status_code == 404
    assert await document_events(client, case["id"], document["id"]) == []
    public = await carlos_client.get(f"/api/v1/asuntos/{case['radicado']}")
    assert {event["id"] for event in public.json()["novedades"]} == {note_id}
    stored_doc = (await db_session.execute(select(DocumentoAsunto).where(DocumentoAsunto.id == uuid.UUID(document["id"])))).scalar_one()
    stored_event = (await db_session.execute(select(Novedad).where(Novedad.id == uuid.UUID(event_id)))).scalar_one()
    assert stored_doc.is_active is False
    assert stored_doc.compartido_con_cliente is False
    assert stored_event.is_active is False
    assert stored_event.publicado_al_cliente is False


@pytest.mark.asyncio
async def test_public_reads_defend_against_legacy_document_visibility_mismatch(
    client, carlos_client, db_session
):
    case = await create_case(client)
    document = await link_document(client, case["id"])
    event = (await document_events(client, case["id"], document["id"]))[0]
    await db_session.execute(update(Novedad).where(Novedad.id == uuid.UUID(event["id"])).values(publicado_al_cliente=True))
    await db_session.commit()
    for endpoint in (
        f"/api/v1/asuntos/{case['radicado']}",
        f"/api/v1/novedades/asunto/{case['id']}",
        "/api/v1/portal/asuntos",
    ):
        response = await carlos_client.get(endpoint)
        assert response.status_code == 200, response.text
        assert event["id"] not in response.text


@pytest.mark.asyncio
async def test_document_publication_rolls_back_both_records_on_failure(
    client, carlos_client, monkeypatch
):
    case = await create_case(client)
    document = await link_document(client, case["id"])
    original = NovedadRepository.stage_document_visibility

    async def fail_after_staging(self, *args, **kwargs):
        await original(self, *args, **kwargs)
        raise RuntimeError("Fallo controlado antes de commit")

    with monkeypatch.context() as patch:
        patch.setattr(NovedadRepository, "stage_document_visibility", fail_after_staging)
        with pytest.raises(RuntimeError, match="Fallo controlado"):
            await client.patch(
                f"/api/v1/documentos/{document['id']}/visibilidad?compartido=true"
            )
    documents = await client.get(f"/api/v1/asuntos/{case['id']}/documentos")
    assert documents.json()[0]["compartido_con_cliente"] is False
    events = await document_events(client, case["id"], document["id"])
    assert events[0]["publicado_al_cliente"] is False
    assert (await carlos_client.get(f"/api/v1/asuntos/{case['id']}/documentos")).json() == []


@pytest.mark.asyncio
async def test_assistant_can_capture_internal_documents_but_cannot_share_or_archive(
    client, sandra_client
):
    case = await create_case(client)
    document = await link_document(sandra_client, case["id"])
    assert document["compartido_con_cliente"] is False
    shared_link = await sandra_client.post(
        f"/api/v1/asuntos/{case['id']}/documentos/vincular",
        json={"nombre_funcional": "Intento compartido", "external_file_id": uuid.uuid4().hex, "web_view_url": "https://drive.google.com/test", "compartido_con_cliente": True},
    )
    assert shared_link.status_code == 403
    shared_upload = await sandra_client.post(
        f"/api/v1/asuntos/{case['id']}/documentos/upload",
        data={"nombre_funcional": "Intento compartido", "compartido_con_cliente": "true"},
        files={"file": ("archivo.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")},
    )
    assert shared_upload.status_code == 403
    assert (await sandra_client.patch(f"/api/v1/documentos/{document['id']}/visibilidad?compartido=false")).status_code == 403
    assert (await sandra_client.delete(f"/api/v1/documentos/{document['id']}")).status_code == 403


@pytest.mark.asyncio
async def test_lawyer_cannot_share_or_archive_documents_of_another_case(
    client, alejandro_client
):
    case = await create_case(client)
    document = await link_document(client, case["id"])
    assert (await alejandro_client.patch(f"/api/v1/documentos/{document['id']}/visibilidad?compartido=true")).status_code == 404
    assert (await alejandro_client.delete(f"/api/v1/documentos/{document['id']}")).status_code == 404
    own_case = await create_case(client, abogado_id=ALEJANDRO_ID)
    own_doc = await link_document(alejandro_client, own_case["id"], shared=True)
    assert (await alejandro_client.patch(f"/api/v1/documentos/{own_doc['id']}/visibilidad?compartido=false")).status_code == 200
    assert (await alejandro_client.delete(f"/api/v1/documentos/{own_doc['id']}")).status_code == 204


@pytest.mark.asyncio
async def test_document_publication_requires_session_and_valid_inputs(
    client, anonymous_client, carlos_client
):
    case = await create_case(client)
    document = await link_document(client, case["id"])
    visibility = f"/api/v1/documentos/{document['id']}/visibilidad"
    assert (await anonymous_client.patch(visibility, params={"compartido": "true"})).status_code == 401
    assert (await anonymous_client.delete(f"/api/v1/documentos/{document['id']}")).status_code == 401
    assert (await carlos_client.patch(visibility, params={"compartido": "true"})).status_code == 403
    assert (await carlos_client.delete(f"/api/v1/documentos/{document['id']}")).status_code == 403
    assert (await client.patch(visibility)).status_code == 422
    assert (await client.patch(visibility, params={"compartido": "valor_invalido"})).status_code == 422
    assert (await client.post(f"/api/v1/asuntos/{case['id']}/documentos/vincular", json={"nombre_funcional": None})).status_code == 422
    assert (await client.patch(f"/api/v1/documentos/{uuid.uuid4()}/visibilidad?compartido=true")).status_code == 404
    assert (await client.delete(f"/api/v1/documentos/{uuid.uuid4()}")).status_code == 404


@pytest.mark.asyncio
async def test_shared_local_document_uses_authorized_preview_url_without_storage_metadata(
    client, carlos_client, elena_client
):
    case = await create_case(client)
    content = b"%PDF-1.4\n% Shared document\n%%EOF"
    uploaded = await client.post(
        f"/api/v1/asuntos/{case['id']}/documentos/upload",
        data={"nombre_funcional": "Soporte compartido", "compartido_con_cliente": "true"},
        files={"file": ("soporte.pdf", content, "application/pdf")},
    )
    assert uploaded.status_code == 201, uploaded.text
    stored = uploaded.json()
    assert stored["provider"] == "local"
    response = await carlos_client.get(f"/api/v1/asuntos/{case['id']}/documentos")
    assert response.status_code == 200
    public_document = response.json()[0]
    assert set(public_document) == PUBLIC_DOCUMENT_FIELDS
    assert public_document["web_view_url"] == f"/api/v1/documentos/{stored['id']}/preview"
    assert stored["external_file_id"] not in response.text
    preview = await carlos_client.get(public_document["web_view_url"])
    assert preview.status_code == 200
    assert preview.content == content
    assert preview.headers["content-disposition"].startswith("inline;")
    assert preview.headers["x-content-type-options"] == "nosniff"
    assert (await elena_client.get(public_document["web_view_url"])).status_code == 404
    assert (await elena_client.get(f"/api/v1/asuntos/{case['id']}/documentos")).status_code == 404


@pytest.mark.asyncio
@pytest.mark.parametrize("filename,mime_type,disposition", [
    ("soporte.txt", "text/plain", "inline"),
    ("pagina.html", "text/html", "attachment"),
    ("grafico.svg", "image/svg+xml", "attachment"),
    ("archivo.bin", "application/octet-stream", "attachment"),
])
async def test_preview_downloads_active_or_unknown_content_without_mime_sniffing(
    client, carlos_client, filename, mime_type, disposition
):
    case = await create_case(client)
    content = b"Synthetic test content"
    uploaded = await client.post(
        f"/api/v1/asuntos/{case['id']}/documentos/upload",
        data={"nombre_funcional": 'Soporte "revisión"', "compartido_con_cliente": "true"},
        files={"file": (filename, content, mime_type)},
    )
    assert uploaded.status_code == 201, uploaded.text
    document_id = uploaded.json()["id"]
    response = await carlos_client.get(f"/api/v1/documentos/{document_id}/preview")
    assert response.status_code == 200
    assert response.content == content
    assert response.headers["content-disposition"].startswith(f"{disposition};")
    assert "filename*=utf-8''" in response.headers["content-disposition"]
    assert response.headers["content-disposition"].endswith(filename[filename.rindex('.'):])
    assert response.headers["x-content-type-options"] == "nosniff"
