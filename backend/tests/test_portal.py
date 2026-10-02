import uuid

import pytest

from app.models.asunto import Asunto
from app.models.cliente import Cliente
from app.models.documento import DocumentoAsunto
from app.models.firma import Firma
from app.models.novedad import Novedad
from app.models.user import User


CARLOS_ID = "00000000-0000-0000-0000-000000000020"
ALEJANDRO_ID = "00000000-0000-0000-0000-000000000011"
PUBLIC_CASE_FIELDS = {
    "id", "radicado", "fecha_apertura", "responsable_nombre", "ultima_novedad_at", "novedades"
}
PUBLIC_EVENT_FIELDS = {"id", "titulo", "descripcion", "tipo", "created_at"}


async def open_case(client, **extra):
    response = await client.post(
        "/api/v1/asuntos",
        json={"cliente_id": CARLOS_ID, **extra},
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_portal_requires_client_role_and_session(
    anonymous_client, client, alejandro_client, sandra_client
):
    assert (await anonymous_client.get("/api/v1/portal/asuntos")).status_code == 401
    for office_client in (client, alejandro_client, sandra_client):
        assert (await office_client.get("/api/v1/portal/asuntos")).status_code == 403


@pytest.mark.asyncio
async def test_portal_and_legacy_routes_serialize_only_authorized_information(
    client, carlos_client
):
    case = await open_case(client)
    public = await client.post(
        f"/api/v1/novedades/asunto/{case['id']}",
        json={"titulo": "Solicitud recibida", "descripcion": "La firma registró su solicitud.", "publicado_al_cliente": True},
    )
    assert public.status_code == 201
    private = await client.post(
        f"/api/v1/novedades/asunto/{case['id']}",
        json={"titulo": "Estrategia reservada", "descripcion": "Análisis interno de riesgos."},
    )
    assert private.status_code == 201
    assert private.json()["publicado_al_cliente"] is False
    advanced = await client.post(
        f"/api/v1/asuntos/{case['id']}/flujo/avanzar",
        json={
            "paso_codigo": "recepcion_evaluacion",
            "datos": {"identidad_verificada": True, "viabilidad_preliminar": "viable", "observaciones": "Evaluación estrictamente interna."},
        },
    )
    assert advanced.status_code == 200, advanced.text
    assert advanced.json()["pasos"][0]["datos"]["observaciones"]

    projected = []
    for endpoint in ("/api/v1/portal/asuntos", "/api/v1/asuntos"):
        response = await carlos_client.get(endpoint)
        assert response.status_code == 200, response.text
        projected.append(next(item for item in response.json() if item["id"] == case["id"]))
    detail = await carlos_client.get(f"/api/v1/asuntos/{case['radicado']}")
    assert detail.status_code == 200
    projected.append(detail.json())
    assert projected[0] == projected[1] == projected[2]
    for body in projected:
        assert set(body) == PUBLIC_CASE_FIELDS
        assert body["responsable_nombre"] == "Dra. Daniela Torres"
        assert body["ultima_novedad_at"] == public.json()["created_at"]
        assert [event["id"] for event in body["novedades"]] == [public.json()["id"]]
        assert set(body["novedades"][0]) == PUBLIC_EVENT_FIELDS
    events = await carlos_client.get(f"/api/v1/novedades/asunto/{case['id']}")
    assert events.status_code == 200
    assert events.json() == projected[0]["novedades"]


@pytest.mark.asyncio
async def test_portal_has_no_update_date_until_a_visible_advance(client, carlos_client):
    case = await open_case(client)
    response = await carlos_client.get(f"/api/v1/asuntos/{case['radicado']}")
    assert response.status_code == 200
    assert response.json()["novedades"] == []
    assert response.json()["ultima_novedad_at"] is None


@pytest.mark.asyncio
async def test_soft_deleted_novedad_disappears_from_public_and_internal_relations(
    client, carlos_client
):
    case = await open_case(client)
    response = await client.post(
        f"/api/v1/novedades/asunto/{case['id']}",
        json={"titulo": "Corrección", "descripcion": "Registro para archivar.", "publicado_al_cliente": True},
    )
    event_id = response.json()["id"]
    assert (await client.delete(f"/api/v1/novedades/{event_id}")).status_code == 204
    assert (await client.delete(f"/api/v1/novedades/{event_id}")).status_code == 404
    for api_client in (client, carlos_client):
        detail = await api_client.get(f"/api/v1/asuntos/{case['radicado']}")
        assert detail.status_code == 200
        assert detail.json()["novedades"] == []
        listed = await api_client.get("/api/v1/asuntos")
        item = next(item for item in listed.json() if item["id"] == case["id"])
        assert item["novedades"] == []
    assert (await carlos_client.get(f"/api/v1/asuntos/{case['radicado']}")).json()["ultima_novedad_at"] is None


@pytest.mark.asyncio
async def test_client_cannot_read_other_clients_public_events(client, elena_client):
    case = await open_case(client)
    for endpoint in (
        f"/api/v1/asuntos/{case['radicado']}",
        f"/api/v1/novedades/asunto/{case['id']}",
    ):
        assert (await elena_client.get(endpoint)).status_code == 404
    listed = await elena_client.get("/api/v1/portal/asuntos")
    assert case["id"] not in {item["id"] for item in listed.json()}


@pytest.mark.asyncio
async def test_lawyer_can_publish_and_delete_only_in_assigned_case(client, alejandro_client):
    foreign_case = await open_case(client)
    own_case = await open_case(client, abogado_id=ALEJANDRO_ID)
    foreign_note = await client.post(
        f"/api/v1/novedades/asunto/{foreign_case['id']}",
        json={"titulo": "Nota ajena", "descripcion": "Reservada"},
    )
    assert (await alejandro_client.delete(f"/api/v1/novedades/{foreign_note.json()['id']}")).status_code == 404
    assert (await alejandro_client.post(
        f"/api/v1/novedades/asunto/{foreign_case['id']}",
        json={"titulo": "Intento", "descripcion": "No autorizado", "publicado_al_cliente": True},
    )).status_code == 404
    own_note = await alejandro_client.post(
        f"/api/v1/novedades/asunto/{own_case['id']}",
        json={"titulo": "Actualización", "descripcion": "Avance verificado", "publicado_al_cliente": True},
    )
    assert own_note.status_code == 201
    assert (await alejandro_client.delete(f"/api/v1/novedades/{own_note.json()['id']}")).status_code == 204


@pytest.mark.asyncio
async def test_assistant_captures_private_novedad_and_cannot_publish_or_delete(client, sandra_client):
    case = await open_case(client)
    private = await sandra_client.post(
        f"/api/v1/novedades/asunto/{case['id']}",
        json={"titulo": "Recepción", "descripcion": "Información recibida para revisión"},
    )
    assert private.status_code == 201
    assert private.json()["publicado_al_cliente"] is False
    assert (await sandra_client.post(
        f"/api/v1/novedades/asunto/{case['id']}",
        json={"titulo": "Intento", "descripcion": "Sin autorización", "publicado_al_cliente": True},
    )).status_code == 403
    assert (await sandra_client.delete(f"/api/v1/novedades/{private.json()['id']}")).status_code == 403


@pytest.mark.asyncio
async def test_publication_mutations_require_session_and_valid_payload(anonymous_client, client):
    case = await open_case(client)
    note_path = f"/api/v1/novedades/asunto/{case['id']}"
    payload = {"titulo": "Avance", "descripcion": "Descripción"}
    assert (await anonymous_client.post(note_path, json=payload)).status_code == 401
    assert (await anonymous_client.delete(f"/api/v1/novedades/{uuid.uuid4()}")).status_code == 401
    assert (await client.post(note_path, json={"titulo": "Incompleto"})).status_code == 422
    assert (await client.post(note_path, json={**payload, "publicado_al_cliente": None})).status_code == 422
    assert (await client.get("/api/v1/novedades/asunto/uuid-invalido")).status_code == 422


@pytest.mark.asyncio
async def test_public_projection_and_mutations_preserve_firma_isolation(
    client, carlos_client, db_session
):
    own_case = await open_case(client)
    firma = Firma(id=uuid.uuid4(), nombre="Firma aislada", subdominio=f"aislada-{uuid.uuid4().hex}")
    actor = User(id=uuid.uuid4(), firma_id=firma.id, nombre="Usuario externo", email=f"externo-{uuid.uuid4().hex}@example.com", cedula=uuid.uuid4().hex, rol="cliente")
    foreign_client = Cliente(id=uuid.uuid4(), firma_id=firma.id, nombre="Cliente externo", email=actor.email, numero_documento=actor.cedula, numero_documento_normalizado=actor.cedula, portal_user_id=actor.id)
    foreign_case = Asunto(id=uuid.uuid4(), firma_id=firma.id, cliente_id=foreign_client.id, radicado=f"EXT-{uuid.uuid4().hex}")
    db_session.add(firma)
    db_session.add(actor)
    await db_session.flush()
    db_session.add(foreign_client)
    await db_session.flush()
    db_session.add(foreign_case)
    await db_session.flush()
    foreign_event = Novedad(firma_id=firma.id, asunto_id=foreign_case.id, titulo="Otra firma", descripcion="Dato externo", publicado_al_cliente=True)
    # Simula un vínculo legado inválido: aun si apunta a un asunto propio,
    # una novedad de otra firma no debe entrar en su relación cargada.
    mismatched_event = Novedad(firma_id=firma.id, asunto_id=uuid.UUID(own_case["id"]), titulo="Vínculo inválido", descripcion="No revelar", publicado_al_cliente=True)
    db_session.add_all([foreign_event, mismatched_event])
    foreign_document = DocumentoAsunto(
        firma_id=firma.id,
        asunto_id=foreign_case.id,
        nombre_funcional="Documento externo",
        external_file_id=uuid.uuid4().hex,
        web_view_url="https://drive.google.com/foreign",
        compartido_con_cliente=True,
    )
    db_session.add(foreign_document)
    await db_session.commit()

    assert (await client.delete(f"/api/v1/novedades/{foreign_event.id}")).status_code == 404
    assert (await client.post(
        f"/api/v1/novedades/asunto/{foreign_case.id}",
        json={"titulo": "Intento", "descripcion": "No autorizado"},
    )).status_code == 404
    assert (await carlos_client.get(f"/api/v1/asuntos/{foreign_case.radicado}")).status_code == 404
    assert (await client.patch(f"/api/v1/documentos/{foreign_document.id}/visibilidad?compartido=false")).status_code == 404
    assert (await client.delete(f"/api/v1/documentos/{foreign_document.id}")).status_code == 404
    assert (await carlos_client.get(f"/api/v1/documentos/{foreign_document.id}/preview")).status_code == 404
    public_cases = await carlos_client.get("/api/v1/portal/asuntos")
    assert str(foreign_case.id) not in {item["id"] for item in public_cases.json()}
    own_public = next(item for item in public_cases.json() if item["id"] == own_case["id"])
    assert own_public["novedades"] == []
    own_internal = await client.get(f"/api/v1/asuntos/{own_case['radicado']}")
    assert own_internal.json()["novedades"] == []
