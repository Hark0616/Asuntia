"""Captura compartida, autorización del portal y límites de responsabilidad."""
import asyncio
import uuid
from types import SimpleNamespace

import pytest
import pytest_asyncio
from sqlalchemy import select, update

from app.core.exceptions import DomainException
from app.models.asunto import Asunto
from app.models.novedad import Novedad
from app.services.workflow_service import WorkflowService


CARLOS_ID = "00000000-0000-0000-0000-000000000020"
ALEJANDRO_ID = "00000000-0000-0000-0000-000000000011"
_created_case_ids: list[str] = []


@pytest_asyncio.fixture(autouse=True)
async def archive_created_cases(client):
    """Evita que la captura de pruebas llene la bandeja compartida de la suite."""
    _created_case_ids.clear()
    yield
    for case_id in _created_case_ids:
        response = await client.delete(f"/api/v1/asuntos/{case_id}")
        assert response.status_code in {204, 404}


async def create_case(client, **extra):
    response = await client.post("/api/v1/asuntos", json={"cliente_id": CARLOS_ID, **extra})
    assert response.status_code == 201, response.text
    case = response.json()
    _created_case_ids.append(case["id"])
    return case


def draft_payload(case, datos=None, **extra):
    step = next(step for step in case["pasos"] if step["estado"] == "activo")
    return {"paso_codigo": step["codigo"], "datos": datos or {}, "expected_updated_at": step["updated_at"], **extra}


async def create_note(client, case):
    response = await client.post(
        f"/api/v1/novedades/asunto/{case['id']}",
        json={"titulo": "Seguimiento", "descripcion": "Observaciones para revisión."},
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_assistant_saves_partial_evaluation_without_advancing_or_publishing(
    client, sandra_client, carlos_client,
):
    case = await create_case(client)
    initial_work = (await client.get("/api/v1/tareas/mi-trabajo")).json()["items"]
    initial_task = next(item for item in initial_work if item["asunto"]["id"] == case["id"])
    path = f"/api/v1/asuntos/{case['id']}/flujo/borrador"
    saved = await sandra_client.patch(path, json=draft_payload(case, {
        "identidad_verificada": False,
        "viabilidad_preliminar": "informacion_insuficiente",
        "observaciones": "Falta acreditar la identidad.",
    }))
    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert body["id"] == case["id"]
    assert body["paso_actual"] == 1
    assert body["etapa_actual"] == case["etapa_actual"]
    assert body["flujo_estado"] == "activo"
    step = body["pasos"][0]
    assert step["id"] == case["pasos"][0]["id"]
    assert step["estado"] == "activo"
    assert step["datos"]["identidad_verificada"] is False
    assert step["completed_at"] is None
    assert step["completed_by_id"] is None
    assert step["updated_at"] != case["pasos"][0]["updated_at"]
    assert (await client.get(f"/api/v1/novedades/asunto/{case['id']}")).json() == []
    assert (await carlos_client.get(f"/api/v1/novedades/asunto/{case['id']}")).json() == []
    public = (await carlos_client.get(f"/api/v1/asuntos/{case['radicado']}")).json()
    assert "pasos" not in public and "Falta acreditar" not in str(public)
    work = (await client.get("/api/v1/tareas/mi-trabajo")).json()["items"]
    persisted_task = next(item for item in work if item["asunto"]["id"] == case["id"])
    assert persisted_task == initial_task
    denied = await sandra_client.post(f"/api/v1/asuntos/{case['id']}/flujo/avanzar", json={
        "paso_codigo": "recepcion_evaluacion", "datos": {},
    })
    assert denied.status_code == 403


@pytest.mark.asyncio
async def test_draft_merges_fields_and_supports_empty_values_and_removal(client):
    case = await create_case(client)
    path = f"/api/v1/asuntos/{case['id']}/flujo/borrador"
    first = await client.patch(path, json=draft_payload(case, {
        "identidad_verificada": False, "observaciones": "Pendiente", "viabilidad_preliminar": "condicionada",
    }))
    assert first.status_code == 200
    second = await client.patch(path, json=draft_payload(first.json(), {"observaciones": "", "viabilidad_preliminar": None}))
    assert second.status_code == 200
    assert second.json()["pasos"][0]["datos"] == {"identidad_verificada": False, "observaciones": ""}
    noop = await client.patch(path, json=draft_payload(second.json()))
    assert noop.status_code == 200
    assert noop.json()["pasos"][0]["datos"] == second.json()["pasos"][0]["datos"]


@pytest.mark.asyncio
async def test_responsible_lawyer_completes_saved_capture_with_full_validation(client, alejandro_client):
    case = await create_case(client, abogado_id=ALEJANDRO_ID)
    path = f"/api/v1/asuntos/{case['id']}/flujo/borrador"
    saved = await alejandro_client.patch(path, json=draft_payload(case, {
        "identidad_verificada": False, "viabilidad_preliminar": "condicionada", "observaciones": "Faltan soportes.",
    }))
    assert saved.status_code == 200
    advance_path = f"/api/v1/asuntos/{case['id']}/flujo/avanzar"
    blocked = await alejandro_client.post(advance_path, json=draft_payload(saved.json()))
    assert blocked.status_code == 400
    viable_needed = await alejandro_client.post(advance_path, json=draft_payload(saved.json(), {"identidad_verificada": True}))
    assert viable_needed.status_code == 409
    advanced = await alejandro_client.post(advance_path, json=draft_payload(saved.json(), {
        "identidad_verificada": True, "viabilidad_preliminar": "viable",
    }))
    assert advanced.status_code == 200, advanced.text
    assert advanced.json()["pasos"][0]["datos"]["observaciones"] == "Faltan soportes."
    assert advanced.json()["paso_actual"] == 2
    assert advanced.json()["pasos"][0]["completed_by_id"] == ALEJANDRO_ID
    events = (await client.get(f"/api/v1/novedades/asunto/{case['id']}")).json()
    assert len(events) == 1 and events[0]["publicado_al_cliente"] is False
    completed = await client.patch(path, json=draft_payload(case))
    assert completed.status_code == 409


@pytest.mark.asyncio
async def test_stale_draft_and_completion_reject_without_overwriting(client, sandra_client):
    case = await create_case(client)
    draft_path = f"/api/v1/asuntos/{case['id']}/flujo/borrador"
    initial = draft_payload(case, {"observaciones": "Captura inicial."})
    first = await sandra_client.patch(draft_path, json=initial)
    assert first.status_code == 200
    stale = await client.patch(draft_path, json={**initial, "datos": {"observaciones": "Valor obsoleto."}})
    assert stale.status_code == 409
    stale_advance = await client.post(f"/api/v1/asuntos/{case['id']}/flujo/avanzar", json={**initial, "datos": {
        "identidad_verificada": True, "viabilidad_preliminar": "viable", "observaciones": "Obsoleto.",
    }})
    assert stale_advance.status_code == 409
    persisted = (await client.get(f"/api/v1/asuntos/{case['radicado']}")).json()
    assert persisted["pasos"][0]["datos"] == {"observaciones": "Captura inicial."}
    assert persisted["paso_actual"] == 1


@pytest.mark.asyncio
async def test_concurrent_drafts_keep_one_version_and_report_conflict(client, sandra_client):
    case = await create_case(client)
    path = f"/api/v1/asuntos/{case['id']}/flujo/borrador"
    responses = await asyncio.gather(
        client.patch(path, json=draft_payload(case, {"observaciones": "Abogado"})),
        sandra_client.patch(path, json=draft_payload(case, {"observaciones": "Auxiliar"})),
    )
    assert sorted(response.status_code for response in responses) == [200, 409]
    winner = next(response for response in responses if response.status_code == 200)
    persisted = (await client.get(f"/api/v1/asuntos/{case['radicado']}")).json()
    assert persisted["pasos"][0]["datos"] == winner.json()["pasos"][0]["datos"]


@pytest.mark.asyncio
async def test_concurrent_save_and_completion_never_overwrite_a_newer_capture(client, sandra_client):
    case = await create_case(client)
    responses = await asyncio.gather(
        client.post(f"/api/v1/asuntos/{case['id']}/flujo/avanzar", json=draft_payload(case, {
            "identidad_verificada": True, "viabilidad_preliminar": "viable", "observaciones": "Completada",
        })),
        sandra_client.patch(f"/api/v1/asuntos/{case['id']}/flujo/borrador", json=draft_payload(case, {"observaciones": "Nueva captura"})),
    )
    assert sorted(response.status_code for response in responses) == [200, 409]
    persisted = (await client.get(f"/api/v1/asuntos/{case['radicado']}")).json()
    if responses[0].status_code == 200:
        assert persisted["pasos"][0]["estado"] == "completado"
        assert persisted["pasos"][0]["datos"]["observaciones"] == "Completada"
    else:
        assert persisted["pasos"][0]["estado"] == "activo"
        assert persisted["pasos"][0]["datos"] == {"observaciones": "Nueva captura"}


@pytest.mark.asyncio
@pytest.mark.parametrize("datos,expected", [
    ({"desconocido": "valor"}, 422),
    ({"identidad_verificada": "false"}, 400),
    ({"identidad_verificada": 1}, 400),
    ({"observaciones": False}, 400),
    ({"observaciones": []}, 400),
    ({"viabilidad_preliminar": "inventada"}, 400),
    ({"viabilidad_preliminar": {}}, 400),
])
async def test_invalid_draft_leaves_capture_unchanged(client, datos, expected):
    case = await create_case(client)
    response = await client.patch(f"/api/v1/asuntos/{case['id']}/flujo/borrador", json=draft_payload(case, datos))
    assert response.status_code == expected
    persisted = (await client.get(f"/api/v1/asuntos/{case['radicado']}")).json()
    assert persisted["pasos"][0]["datos"] == {}
    unknown_advance = await client.post(f"/api/v1/asuntos/{case['id']}/flujo/avanzar", json={
        "paso_codigo": "recepcion_evaluacion", "datos": {"desconocido": True},
    })
    assert unknown_advance.status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize("mutation", [
    {"expected_updated_at": None}, {"expected_updated_at": "fecha"},
    {"expected_updated_at": "2026-10-02T12:00:00"}, {"datos": None}, {"paso_codigo": None},
    {"extra": True},
])
async def test_draft_requires_valid_contract(client, mutation):
    case = await create_case(client)
    path = f"/api/v1/asuntos/{case['id']}/flujo/borrador"
    assert (await client.patch(path, json={**draft_payload(case), **mutation})).status_code == 422
    missing_version = draft_payload(case)
    missing_version.pop("expected_updated_at")
    assert (await client.patch(path, json=missing_version)).status_code == 422


@pytest.mark.asyncio
async def test_draft_enforces_session_assignment_active_step_and_tenant(
    client, anonymous_client, carlos_client, alejandro_client, db_session,
):
    case = await create_case(client)
    path = f"/api/v1/asuntos/{case['id']}/flujo/borrador"
    payload = draft_payload(case, {"observaciones": "Captura"})
    assert (await anonymous_client.patch(path, json=payload)).status_code == 401
    assert (await carlos_client.patch(path, json=payload)).status_code == 403
    assert (await alejandro_client.patch(path, json=payload)).status_code == 404
    assert (await client.patch(path, json={**payload, "paso_codigo": "radicacion"})).status_code == 409
    assert (await client.patch(f"/api/v1/asuntos/{uuid.uuid4()}/flujo/borrador", json=payload)).status_code == 404
    await db_session.execute(update(Asunto).where(Asunto.id == uuid.UUID(case["id"])).values(firma_id=uuid.uuid4()))
    await db_session.commit()
    assert (await client.patch(path, json=payload)).status_code == 404


@pytest.mark.parametrize("kind,value", [
    ("date", "2026-02-30"), ("date", "20261002"), ("datetime", "2026-10-02"),
    ("datetime", "2026-10-02T25:00"), ("url", "javascript:alert(1)"), ("url", "https://"),
])
def test_partial_capture_validates_temporal_and_url_formats(kind, value):
    step = SimpleNamespace(campos=[{"clave": "dato", "tipo": kind, "etiqueta": "Dato"}], datos={})
    with pytest.raises(DomainException) as error:
        WorkflowService._merge_step_data(step, {"dato": value})
    assert error.value.status_code == 400
    assert WorkflowService._merge_step_data(step, {"dato": ""}) == {"dato": ""}


@pytest.mark.asyncio
async def test_note_visibility_is_idempotent_preserves_author_and_revokes_portal(
    client, sandra_client, carlos_client, db_session,
):
    case = await create_case(client)
    note = await create_note(sandra_client, case)
    stored = (await db_session.execute(select(Novedad).where(Novedad.id == uuid.UUID(note["id"])))).scalar_one()
    author = stored.created_by_id
    assert note["publicado_al_cliente"] is False
    path = f"/api/v1/novedades/{note['id']}/visibilidad"
    for visible in (True, True, False, False):
        response = await client.patch(path, json={"publicado_al_cliente": visible})
        assert response.status_code == 200, response.text
        assert response.json()["id"] == note["id"]
        assert response.json()["created_at"] == note["created_at"]
        assert response.json()["descripcion"] == note["descripcion"]
        public = (await carlos_client.get(f"/api/v1/novedades/asunto/{case['id']}")).json()
        assert (note["id"] in {item["id"] for item in public}) is visible
    await db_session.refresh(stored)
    assert stored.created_by_id == author
    assert stored.is_active is True
    assert len((await client.get(f"/api/v1/novedades/asunto/{case['id']}")).json()) == 1
    assert (await client.delete(f"/api/v1/novedades/{note['id']}")).status_code == 204
    assert (await client.patch(path, json={"publicado_al_cliente": True})).status_code == 404


@pytest.mark.asyncio
async def test_visibility_permissions_tenant_and_derived_events(
    client, alejandro_client, sandra_client, carlos_client, anonymous_client, db_session,
):
    case = await create_case(client)
    note = await create_note(sandra_client, case)
    path = f"/api/v1/novedades/{note['id']}/visibilidad"
    payload = {"publicado_al_cliente": True}
    assert (await anonymous_client.patch(path, json=payload)).status_code == 401
    assert (await carlos_client.patch(path, json=payload)).status_code == 403
    assert (await sandra_client.patch(path, json=payload)).status_code == 403
    assert (await alejandro_client.patch(path, json=payload)).status_code == 404
    assert (await client.patch(f"/api/v1/novedades/{uuid.uuid4()}/visibilidad", json=payload)).status_code == 404
    await db_session.execute(update(Novedad).where(Novedad.id == uuid.UUID(note["id"])).values(tipo="documento_incorporado"))
    await db_session.commit()
    assert (await client.patch(path, json=payload)).status_code == 409
    await db_session.execute(update(Novedad).where(Novedad.id == uuid.UUID(note["id"])).values(tipo="paso_completado"))
    await db_session.commit()
    assert (await client.patch(path, json=payload)).status_code == 409
    await db_session.execute(update(Novedad).where(Novedad.id == uuid.UUID(note["id"])).values(firma_id=uuid.uuid4()))
    await db_session.commit()
    assert (await client.patch(path, json=payload)).status_code == 404
    own_case = await create_case(client, abogado_id=ALEJANDRO_ID)
    own_note = await create_note(sandra_client, own_case)
    own_path = f"/api/v1/novedades/{own_note['id']}/visibilidad"
    assert (await alejandro_client.patch(own_path, json=payload)).status_code == 200
    assert (await alejandro_client.patch(own_path, json={"publicado_al_cliente": False})).status_code == 200


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", [{}, {"publicado_al_cliente": None}, {"publicado_al_cliente": "true"}, {"publicado_al_cliente": 1}, {"publicado_al_cliente": True, "tipo": "nota"}])
async def test_visibility_requires_strict_boolean_and_known_contract(client, payload):
    case = await create_case(client)
    note = await create_note(client, case)
    assert (await client.patch(f"/api/v1/novedades/{note['id']}/visibilidad", json=payload)).status_code == 422


@pytest.mark.asyncio
async def test_only_responsible_lawyer_or_admin_change_state(client, alejandro_client, sandra_client):
    own_case = await create_case(client, abogado_id=ALEJANDRO_ID)
    other_case = await create_case(client)
    payload = {"estado_id": "00000000-0000-0000-0000-000000000102"}
    assert (await alejandro_client.patch(f"/api/v1/asuntos/{own_case['id']}/estado", json=payload)).status_code == 200
    assert (await alejandro_client.patch(f"/api/v1/asuntos/{other_case['id']}/estado", json=payload)).status_code == 404
    assert (await sandra_client.patch(f"/api/v1/asuntos/{own_case['id']}/estado", json=payload)).status_code == 403
    missing_state = {"estado_id": str(uuid.uuid4())}
    assert (await alejandro_client.patch(f"/api/v1/asuntos/{own_case['id']}/estado", json=missing_state)).status_code == 404
