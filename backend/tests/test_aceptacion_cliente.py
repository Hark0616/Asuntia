"""Recorridos del portal con cuentas sintéticas y archivos temporales locales."""

import uuid

import pytest
import pytest_asyncio


CARLOS_ID = "00000000-0000-0000-0000-000000000020"
ELENA_ID = "00000000-0000-0000-0000-000000000040"
ADMIN_ID = "00000000-0000-0000-0000-000000000010"
DOCUMENT_TEXT = b"Soporte sintetico autorizado para la prueba del portal."


@pytest_asyncio.fixture
async def acceptance_case_ids(client):
    """Retira los asuntos del recorrido sin alterar los datos seed compartidos."""
    case_ids = []
    try:
        yield case_ids
    finally:
        for case_id in case_ids:
            response = await client.delete(f"/api/v1/asuntos/{case_id}")
            assert response.status_code in {204, 404}, response.text


async def open_case(client, case_ids, *, cliente_id=CARLOS_ID):
    response = await client.post(
        "/api/v1/asuntos",
        json={"titulo": "Aceptacion portal - asunto privado", "cliente_id": cliente_id},
    )
    assert response.status_code == 201, response.text
    case = response.json()
    case_ids.append(case["id"])
    return case


async def upload_local_document(client, case, *, shared=False):
    response = await client.post(
        f"/api/v1/asuntos/{case['id']}/documentos/upload",
        data={
            "nombre_funcional": "Soporte del cliente",
            "tipo_documental": "anexo",
            "compartido_con_cliente": str(shared).lower(),
            "operation_id": str(uuid.uuid4()),
        },
        files={"file": ("soporte.txt", DOCUMENT_TEXT, "text/plain")},
    )
    assert response.status_code == 201, response.text
    assert response.json()["provider"] == "local"
    return response.json()


async def portal_case(api_client, case_id):
    response = await api_client.get("/api/v1/portal/asuntos")
    assert response.status_code == 200, response.text
    return next(item for item in response.json() if item["id"] == case_id)


@pytest.mark.asyncio
async def test_cliente_consulta_solo_publicado_y_el_retiro_revoca_contenido(
    client, carlos_client, acceptance_case_ids
):
    case = await open_case(client, acceptance_case_ids)
    note_response = await client.post(
        f"/api/v1/novedades/asunto/{case['id']}",
        json={"titulo": "Comunicacion revisada", "descripcion": "Texto para el cliente."},
    )
    assert note_response.status_code == 201, note_response.text
    note = note_response.json()
    document = await upload_local_document(client, case)
    documents_path = f"/api/v1/asuntos/{case['id']}/documentos"
    preview_path = f"/api/v1/documentos/{document['id']}/preview"
    notes_path = f"/api/v1/novedades/asunto/{case['id']}"

    # Ni un parametro elegido por el cliente puede abrir el contenido interno.
    assert (await carlos_client.get(f"{documents_path}?solo_compartidos=false")).json() == []
    assert (await carlos_client.get(f"{notes_path}?solo_publicas=false")).json() == []
    assert (await carlos_client.get(preview_path)).status_code == 404
    initial = await portal_case(carlos_client, case["id"])
    assert initial["novedades"] == []
    assert initial["ultima_novedad_at"] is None

    publish_note = await client.patch(
        f"/api/v1/novedades/{note['id']}/visibilidad",
        json={"publicado_al_cliente": True},
    )
    assert publish_note.status_code == 200, publish_note.text
    publish_document = await client.patch(
        f"/api/v1/documentos/{document['id']}/visibilidad?compartido=true"
    )
    assert publish_document.status_code == 200, publish_document.text

    visible = await portal_case(carlos_client, case["id"])
    assert len(visible["novedades"]) == 2
    assert {item["tipo"] for item in visible["novedades"]} == {"nota", "documento_incorporado"}
    assert note["id"] in {item["id"] for item in visible["novedades"]}
    assert visible["ultima_novedad_at"] == visible["novedades"][0]["created_at"]
    assert "pasos" not in visible and "cliente" not in visible

    documents = await carlos_client.get(documents_path)
    assert documents.status_code == 200, documents.text
    assert len(documents.json()) == 1
    public_document = documents.json()[0]
    assert public_document["id"] == document["id"]
    assert public_document["web_view_url"] == preview_path
    assert not {"external_file_id", "storage_connection_id", "content_sha256", "firma_id", "web_download_url"}.intersection(public_document)
    preview = await carlos_client.get(public_document["web_view_url"])
    assert preview.status_code == 200, preview.text
    assert preview.content == DOCUMENT_TEXT
    assert preview.headers["cache-control"] == "private, no-store"
    assert preview.headers["x-content-type-options"] == "nosniff"

    withdraw_note = await client.patch(
        f"/api/v1/novedades/{note['id']}/visibilidad",
        json={"publicado_al_cliente": False},
    )
    assert withdraw_note.status_code == 200, withdraw_note.text
    withdraw_document = await client.patch(
        f"/api/v1/documentos/{document['id']}/visibilidad?compartido=false"
    )
    assert withdraw_document.status_code == 200, withdraw_document.text
    withdrawn = await portal_case(carlos_client, case["id"])
    assert withdrawn["novedades"] == []
    assert withdrawn["ultima_novedad_at"] is None
    assert (await carlos_client.get(documents_path)).json() == []
    assert (await carlos_client.get(preview_path)).status_code == 404

    # Retirar la publicacion conserva la evidencia interna y el mismo archivo.
    internal_notes = await client.get(notes_path)
    assert internal_notes.status_code == 200, internal_notes.text
    assert len(internal_notes.json()) == 2
    assert (await client.get(preview_path)).content == DOCUMENT_TEXT
    assert (await client.patch(
        f"/api/v1/documentos/{document['id']}/visibilidad?compartido=true"
    )).status_code == 200
    assert (await carlos_client.get(preview_path)).content == DOCUMENT_TEXT
    assert (await client.delete(f"/api/v1/documentos/{document['id']}")).status_code == 204
    assert (await carlos_client.get(preview_path)).status_code == 404
    assert (await carlos_client.get(documents_path)).json() == []
    assert (await portal_case(carlos_client, case["id"]))["novedades"] == []


@pytest.mark.asyncio
async def test_cliente_no_cruza_titular_y_archivar_un_asunto_no_retira_los_otros(
    client, carlos_client, elena_client, acceptance_case_ids
):
    first_case = await open_case(client, acceptance_case_ids)
    second_case = await open_case(client, acceptance_case_ids)
    other_client_case = await open_case(client, acceptance_case_ids, cliente_id=ELENA_ID)
    document = await upload_local_document(client, first_case, shared=True)
    document_path = f"/api/v1/documentos/{document['id']}/preview"

    own_cases = await carlos_client.get("/api/v1/portal/asuntos")
    assert own_cases.status_code == 200, own_cases.text
    own_ids = {item["id"] for item in own_cases.json()}
    assert {first_case["id"], second_case["id"]}.issubset(own_ids)
    assert other_client_case["id"] not in own_ids
    for api_client, inaccessible in (
        (carlos_client, other_client_case), (elena_client, first_case)
    ):
        for path in (
            f"/api/v1/asuntos/id/{inaccessible['id']}",
            f"/api/v1/asuntos/{inaccessible['radicado']}",
            f"/api/v1/novedades/asunto/{inaccessible['id']}",
            f"/api/v1/asuntos/{inaccessible['id']}/documentos?solo_compartidos=false",
        ):
            response = await api_client.get(path)
            assert response.status_code == 404, (path, response.text)
    assert (await elena_client.get(document_path)).status_code == 404
    assert (await carlos_client.get(document_path)).status_code == 200

    assert (await client.delete(f"/api/v1/asuntos/{first_case['id']}")).status_code == 204
    for path in (
        f"/api/v1/asuntos/id/{first_case['id']}",
        f"/api/v1/asuntos/{first_case['radicado']}",
        f"/api/v1/novedades/asunto/{first_case['id']}",
        f"/api/v1/asuntos/{first_case['id']}/documentos",
        document_path,
    ):
        response = await carlos_client.get(path)
        assert response.status_code == 404, (path, response.text)
    remaining = await carlos_client.get("/api/v1/portal/asuntos")
    assert remaining.status_code == 200, remaining.text
    remaining_ids = {item["id"] for item in remaining.json()}
    assert first_case["id"] not in remaining_ids
    assert second_case["id"] in remaining_ids
    assert (await carlos_client.get(f"/api/v1/asuntos/id/{second_case['id']}")).status_code == 200
    assert (await elena_client.get(f"/api/v1/asuntos/id/{other_client_case['id']}")).status_code == 200


@pytest.mark.asyncio
async def test_cliente_no_puede_ejecutar_comandos_de_la_oficina(
    client, carlos_client, acceptance_case_ids
):
    case = await open_case(client, acceptance_case_ids)
    document = await upload_local_document(client, case, shared=True)
    note = await client.post(
        f"/api/v1/novedades/asunto/{case['id']}",
        json={"titulo": "Avance autorizado", "descripcion": "Para consulta.", "publicado_al_cliente": True},
    )
    assert note.status_code == 201, note.text
    commands = (
        ("POST", "/api/v1/asuntos", {"titulo": "Intento", "cliente_id": CARLOS_ID}),
        ("POST", f"/api/v1/novedades/asunto/{case['id']}", {"titulo": "Intento", "descripcion": "Sin permiso"}),
        ("PATCH", f"/api/v1/novedades/{note.json()['id']}/visibilidad", {"publicado_al_cliente": False}),
        ("DELETE", f"/api/v1/novedades/{note.json()['id']}", None),
        ("PATCH", f"/api/v1/asuntos/{case['id']}/responsable", {"responsable_id": ADMIN_ID}),
        ("PATCH", f"/api/v1/asuntos/{case['id']}/estado", {"estado_id": None}),
        ("PATCH", f"/api/v1/documentos/{document['id']}/visibilidad?compartido=false", None),
        ("DELETE", f"/api/v1/documentos/{document['id']}", None),
        ("DELETE", f"/api/v1/asuntos/{case['id']}", None),
    )
    for method, path, payload in commands:
        response = await carlos_client.request(method, path, json=payload)
        assert response.status_code == 403, (method, path, response.text)
    for path in ("/api/v1/clientes", "/api/v1/equipo/gestion", "/api/v1/equipo/miembros", "/api/v1/asuntos/busqueda"):
        response = await carlos_client.get(path)
        assert response.status_code == 403, (path, response.text)
    assert (await carlos_client.get(f"/api/v1/asuntos/id/{case['id']}")).status_code == 200
    assert (await carlos_client.get(f"/api/v1/documentos/{document['id']}/preview")).content == DOCUMENT_TEXT
    assert note.json()["id"] in {item["id"] for item in (await portal_case(carlos_client, case["id"]))["novedades"]}


@pytest.mark.asyncio
async def test_cliente_cierra_sesion_y_su_cookie_anterior_no_reabre_el_portal(
    client, carlos_client, anonymous_client, acceptance_case_ids
):
    case = await open_case(client, acceptance_case_ids)
    document = await upload_local_document(client, case, shared=True)
    previous_cookie = carlos_client.cookies.get("access_token")
    assert previous_cookie
    assert (await carlos_client.get("/api/v1/portal/asuntos")).status_code == 200

    response = await carlos_client.post("/api/v1/auth/logout")
    assert response.status_code == 204, response.text
    assert (await carlos_client.get("/api/v1/portal/asuntos")).status_code == 401
    for path in (
        "/api/v1/auth/me",
        "/api/v1/portal/asuntos",
        f"/api/v1/asuntos/id/{case['id']}",
        f"/api/v1/documentos/{document['id']}/preview",
    ):
        replay = await anonymous_client.get(path, headers={"Cookie": f"access_token={previous_cookie}"})
        assert replay.status_code == 401, (path, replay.text)
    assert (await client.get(f"/api/v1/asuntos/id/{case['id']}")).status_code == 200
