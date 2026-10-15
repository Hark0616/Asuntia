"""Recorridos de secretaría sobre la API y archivos privados de prueba."""

from datetime import datetime, timedelta, timezone
import uuid

import pytest
import pytest_asyncio


pytestmark = pytest.mark.asyncio

CARLOS_ID = "00000000-0000-0000-0000-000000000020"
ALEJANDRO_ID = "00000000-0000-0000-0000-000000000011"
SANDRA_ID = "00000000-0000-0000-0000-000000000012"
CASE_PREFIX = "QA-AUX-ACEPTACION-"


@pytest_asyncio.fixture(autouse=True)
async def archive_auxiliary_acceptance_cases(client):
    """Archiva solo los expedientes de este módulo, incluso si falla el recorrido."""
    yield
    while True:
        response = await client.get(
            "/api/v1/asuntos/busqueda", params={"q": CASE_PREFIX, "por_pagina": 100}
        )
        assert response.status_code == 200, response.text
        cases = response.json()["items"]
        if not cases:
            break
        for case in cases:
            archived = await client.delete(f"/api/v1/asuntos/{case['id']}")
            assert archived.status_code == 204, archived.text


async def _open_case(sandra_client, *, guided=False):
    payload = {
        "titulo": f"{CASE_PREFIX}{uuid.uuid4().hex}",
        "cliente_id": CARLOS_ID,
        "abogado_id": ALEJANDRO_ID,
    }
    if guided:
        payload["ruta_codigo"] = "insolvencia_persona_natural:v2"
    response = await sandra_client.post("/api/v1/asuntos/apertura", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


async def _delegate_task(client, asunto_id, *, responsable_id=SANDRA_ID, due=None):
    payload = {
        "asunto_id": asunto_id,
        "titulo": "Confirmar recepción de documentos",
        "instruccion": "Revisar los soportes y avisar al abogado responsable.",
        "responsable_id": responsable_id,
    }
    if due:
        payload["vence_en"] = due.isoformat()
    response = await client.post("/api/v1/tareas", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


async def test_auxiliary_opens_new_client_and_case_without_duplicate_capture(sandra_client):
    token = uuid.uuid4().hex
    profile = {
        "nombre": "Cliente de aceptación auxiliar",
        "numero_documento": f"QA-AUX-{token}",
        "email": f"qa-aux-{token}@example.com",
        "habilitar_portal": False,
    }
    payload = {
        "titulo": f"{CASE_PREFIX}{token}",
        "cliente_nuevo": profile,
        "abogado_id": ALEJANDRO_ID,
    }
    response = await sandra_client.post("/api/v1/asuntos/apertura", json=payload)
    assert response.status_code == 201, response.text
    case = response.json()
    assert case["abogado_id"] == ALEJANDRO_ID
    assert case["ruta_codigo"] is None
    assert case["pasos"] == []
    assert case["codigo_interno"]
    assert case["radicado_oficial"] is None

    profiles = await sandra_client.get("/api/v1/clientes")
    assert profiles.status_code == 200, profiles.text
    matches = [item for item in profiles.json() if item["email"] == profile["email"]]
    assert len(matches) == 1
    assert matches[0]["id"] == case["cliente_id"] == case["cliente"]["id"]
    assert matches[0]["responsable_id"] == ALEJANDRO_ID
    assert matches[0]["portal_habilitado"] is False

    search = await sandra_client.get(
        "/api/v1/asuntos/busqueda", params={"q": case["codigo_interno"]}
    )
    assert search.status_code == 200, search.text
    assert search.json()["total"] == 1
    assert search.json()["items"][0]["id"] == case["id"]
    detail = await sandra_client.get(f"/api/v1/asuntos/id/{case['id']}")
    assert detail.status_code == 200, detail.text
    assert detail.json()["cliente"]["id"] == matches[0]["id"]

    # Un auxiliar debe escoger responsable; el fallo no crea otro perfil huérfano.
    rejected_profile = {**profile, "numero_documento": f"QA-ERR-{token}",
                        "email": f"qa-error-{token}@example.com"}
    rejected = await sandra_client.post(
        "/api/v1/asuntos/apertura",
        json={"titulo": "Sin responsable", "cliente_nuevo": rejected_profile},
    )
    assert rejected.status_code == 422, rejected.text
    profiles_after = await sandra_client.get("/api/v1/clientes")
    assert profiles_after.status_code == 200, profiles_after.text
    assert all(item["email"] != rejected_profile["email"] for item in profiles_after.json())


async def test_auxiliary_receives_starts_and_completes_delegated_work(client, sandra_client):
    case = await _open_case(sandra_client)
    due = (datetime.now(timezone.utc) + timedelta(days=1)).replace(microsecond=0)
    task = await _delegate_task(client, case["id"], due=due)

    work = await sandra_client.get("/api/v1/tareas/mi-trabajo?limit=100")
    assert work.status_code == 200, work.text
    assigned = next(item for item in work.json()["items"] if item["id"] == task["id"])
    assert assigned["asunto"]["id"] == case["id"]
    assert assigned["responsable"]["id"] == SANDRA_ID

    interval = {"desde": (due - timedelta(hours=1)).isoformat(),
                "hasta": (due + timedelta(hours=1)).isoformat()}
    agenda = await sandra_client.get("/api/v1/tareas/agenda", params=interval)
    assert agenda.status_code == 200, agenda.text
    scheduled = next(item for item in agenda.json()["items"]
                     if item["id"] == f"tarea:{task['id']}")
    assert scheduled["origen"] == "tarea"
    assert datetime.fromisoformat(scheduled["fecha"]) == due

    started = await sandra_client.patch(
        f"/api/v1/tareas/{task['id']}",
        json={"expected_updated_at": task["updated_at"], "estado": "en_progreso"},
    )
    assert started.status_code == 200, started.text
    assert started.json()["estado"] == "en_progreso"

    stale = await sandra_client.patch(
        f"/api/v1/tareas/{task['id']}",
        json={"expected_updated_at": task["updated_at"], "estado": "completada"},
    )
    assert stale.status_code == 409, stale.text
    completed = await sandra_client.patch(
        f"/api/v1/tareas/{task['id']}",
        json={"expected_updated_at": started.json()["updated_at"], "estado": "completada"},
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["estado"] == "completada"

    work_after = await sandra_client.get("/api/v1/tareas/mi-trabajo?limit=100")
    assert work_after.status_code == 200, work_after.text
    assert all(item["id"] != task["id"] for item in work_after.json()["items"])
    agenda_after = await sandra_client.get("/api/v1/tareas/agenda", params=interval)
    assert agenda_after.status_code == 200, agenda_after.text
    assert all(item["id"] != f"tarea:{task['id']}" for item in agenda_after.json()["items"])
    history = await sandra_client.get(f"/api/v1/tareas/asunto/{case['id']}")
    assert history.status_code == 200, history.text
    assert next(item for item in history.json() if item["id"] == task["id"])["estado"] == "completada"

    reopen = await sandra_client.patch(
        f"/api/v1/tareas/{task['id']}",
        json={"expected_updated_at": completed.json()["updated_at"], "estado": "pendiente"},
    )
    assert reopen.status_code == 409, reopen.text


async def test_auxiliary_captures_private_note_and_file_before_lawyer_publication(
    client, sandra_client, carlos_client
):
    case = await _open_case(sandra_client)
    note = await sandra_client.post(
        f"/api/v1/novedades/asunto/{case['id']}",
        json={"titulo": "Soportes recibidos", "descripcion": "Pendiente revisión profesional."},
    )
    assert note.status_code == 201, note.text
    assert note.json()["publicado_al_cliente"] is False
    content = b"Soporte sintetico de aceptacion del auxiliar.\n"
    upload = await sandra_client.post(
        f"/api/v1/asuntos/{case['id']}/documentos/upload",
        data={"nombre_funcional": "Soporte de secretaría", "tipo_documental": "anexo",
              "operation_id": str(uuid.uuid4())},
        files={"file": ("soporte-secretaria.txt", content, "text/plain")},
    )
    assert upload.status_code == 201, upload.text
    doc = upload.json()
    assert doc["provider"] == "local"
    assert doc["compartido_con_cliente"] is False
    preview = await sandra_client.get(f"/api/v1/documentos/{doc['id']}/preview")
    assert preview.status_code == 200, preview.text
    assert preview.content == content
    private_preview = await carlos_client.get(f"/api/v1/documentos/{doc['id']}/preview")
    assert private_preview.status_code == 404, private_preview.text

    public_notes = await carlos_client.get(f"/api/v1/novedades/asunto/{case['id']}")
    public_docs = await carlos_client.get(f"/api/v1/asuntos/{case['id']}/documentos")
    assert public_notes.status_code == 200, public_notes.text
    assert public_docs.status_code == 200, public_docs.text
    assert all(item["id"] != note.json()["id"] for item in public_notes.json())
    assert all(item["id"] != doc["id"] for item in public_docs.json())

    forbidden_note = await sandra_client.post(
        f"/api/v1/novedades/asunto/{case['id']}",
        json={"titulo": "Intento publicación", "descripcion": "No autorizado.",
              "publicado_al_cliente": True},
    )
    assert forbidden_note.status_code == 403, forbidden_note.text
    for path, params, body in [
        (f"/api/v1/novedades/{note.json()['id']}/visibilidad", None,
         {"publicado_al_cliente": True}),
        (f"/api/v1/documentos/{doc['id']}/visibilidad", {"compartido": "true"}, None),
    ]:
        rejected = await sandra_client.patch(path, params=params, json=body)
        assert rejected.status_code == 403, rejected.text
    forbidden_upload = await sandra_client.post(
        f"/api/v1/asuntos/{case['id']}/documentos/upload",
        data={"nombre_funcional": "Intento publicación", "compartido_con_cliente": "true"},
        files={"file": ("otro-soporte.txt", content, "text/plain")},
    )
    assert forbidden_upload.status_code == 403, forbidden_upload.text

    shared_note = await client.patch(
        f"/api/v1/novedades/{note.json()['id']}/visibilidad",
        json={"publicado_al_cliente": True},
    )
    shared_doc = await client.patch(
        f"/api/v1/documentos/{doc['id']}/visibilidad", params={"compartido": "true"}
    )
    assert shared_note.status_code == 200, shared_note.text
    assert shared_doc.status_code == 200, shared_doc.text
    visible_notes = await carlos_client.get(f"/api/v1/novedades/asunto/{case['id']}")
    visible_docs = await carlos_client.get(f"/api/v1/asuntos/{case['id']}/documentos")
    assert visible_notes.status_code == 200, visible_notes.text
    assert visible_docs.status_code == 200, visible_docs.text
    assert note.json()["id"] in {item["id"] for item in visible_notes.json()}
    assert doc["id"] in {item["id"] for item in visible_docs.json()}
    authorized_preview = await carlos_client.get(f"/api/v1/documentos/{doc['id']}/preview")
    assert authorized_preview.status_code == 200, authorized_preview.text
    assert authorized_preview.content == content


async def test_auxiliary_saves_guide_draft_without_advancing_or_publishing(
    sandra_client, alejandro_client, carlos_client
):
    case = await _open_case(sandra_client, guided=True)
    first = next(step for step in case["pasos"] if step["estado"] == "activo")
    draft = await sandra_client.patch(
        f"/api/v1/asuntos/{case['id']}/flujo/borrador",
        json={"paso_codigo": first["codigo"], "datos": {"identidad_verificada": True},
              "expected_updated_at": first["updated_at"]},
    )
    assert draft.status_code == 200, draft.text
    saved_first = next(step for step in draft.json()["pasos"] if step["id"] == first["id"])
    assert saved_first["estado"] == "activo"
    assert saved_first["datos"]["identidad_verificada"] is True
    assert saved_first["completed_at"] is None

    stale = await sandra_client.patch(
        f"/api/v1/asuntos/{case['id']}/flujo/borrador",
        json={"paso_codigo": first["codigo"], "datos": {"identidad_verificada": False},
              "expected_updated_at": first["updated_at"]},
    )
    assert stale.status_code == 409, stale.text
    advance = await sandra_client.post(
        f"/api/v1/asuntos/{case['id']}/flujo/avanzar",
        json={"paso_codigo": first["codigo"], "datos": {}},
    )
    assert advance.status_code == 403, advance.text
    lawyer = await alejandro_client.get(f"/api/v1/asuntos/id/{case['id']}")
    assert lawyer.status_code == 200, lawyer.text
    lawyer_first = next(step for step in lawyer.json()["pasos"] if step["id"] == first["id"])
    assert lawyer_first["datos"]["identidad_verificada"] is True
    public_case = await carlos_client.get(f"/api/v1/asuntos/id/{case['id']}")
    assert public_case.status_code == 200, public_case.text
    assert "pasos" not in public_case.json()
    public_notes = await carlos_client.get(f"/api/v1/novedades/asunto/{case['id']}")
    assert public_notes.status_code == 200, public_notes.text
    assert public_notes.json() == []


async def test_auxiliary_cannot_manage_team_assignment_or_other_peoples_tasks(client, sandra_client):
    case = await _open_case(sandra_client)
    own = await _delegate_task(client, case["id"])
    other = await _delegate_task(client, case["id"], responsable_id=ALEJANDRO_ID)
    for task, changes in [
        (own, {"responsable_id": ALEJANDRO_ID}),
        (own, {"titulo": "Cambio de instrucción no permitido"}),
        (other, {"estado": "completada"}),
    ]:
        response = await sandra_client.patch(
            f"/api/v1/tareas/{task['id']}",
            json={"expected_updated_at": task["updated_at"], **changes},
        )
        assert response.status_code == 403, response.text

    for endpoint in ["/api/v1/equipo/gestion", "/api/v1/tareas/mi-trabajo?alcance=equipo"]:
        response = await sandra_client.get(endpoint)
        assert response.status_code == 403, response.text
    assert (await sandra_client.get('/api/v1/tareas/agenda?alcance=equipo')).status_code == 200
    create_task = await sandra_client.post(
        "/api/v1/tareas", json={"asunto_id": case["id"], "titulo": "Delegación no permitida",
                               "instruccion": "Probar límite de rol.", "responsable_id": SANDRA_ID},
    )
    assert create_task.status_code == 403, create_task.text
    assign = await sandra_client.patch(
        f"/api/v1/asuntos/{case['id']}/responsable", json={"responsable_id": SANDRA_ID}
    )
    assert assign.status_code == 403, assign.text
    state = await sandra_client.patch(f"/api/v1/asuntos/{case['id']}/estado", json={"estado_id": None})
    assert state.status_code == 403, state.text
    archive = await sandra_client.delete(f"/api/v1/asuntos/{case['id']}")
    assert archive.status_code == 403, archive.text


async def test_auxiliary_rejects_invalid_missing_and_archived_targets(
    client, sandra_client, anonymous_client
):
    case = await _open_case(sandra_client)
    task = await _delegate_task(client, case["id"])
    unauthorized = await anonymous_client.get(f"/api/v1/tareas/asunto/{case['id']}")
    assert unauthorized.status_code == 401, unauthorized.text
    missing = await sandra_client.post(
        f"/api/v1/novedades/asunto/{uuid.uuid4()}",
        json={"titulo": "Sin expediente", "descripcion": "No debe guardarse."},
    )
    assert missing.status_code == 404, missing.text
    invalid = await sandra_client.patch(
        f"/api/v1/tareas/{task['id']}",
        json={"expected_updated_at": task["updated_at"], "estado": None},
    )
    assert invalid.status_code == 422, invalid.text
    archive = await client.delete(f"/api/v1/asuntos/{case['id']}")
    assert archive.status_code == 204, archive.text
    archived_notes = await sandra_client.post(
        f"/api/v1/novedades/asunto/{case['id']}",
        json={"titulo": "Expediente archivado", "descripcion": "No debe guardarse."},
    )
    assert archived_notes.status_code == 404, archived_notes.text
    archived_task = await sandra_client.patch(
        f"/api/v1/tareas/{task['id']}",
        json={"expected_updated_at": task["updated_at"], "estado": "completada"},
    )
    assert archived_task.status_code == 404, archived_task.text
