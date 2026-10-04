"""Delegación operativa, concurrencia y límites frente al flujo jurídico."""
import asyncio
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.security import get_password_hash
from app.main import app
from app.models.firma import Firma
from app.models.tarea import Tarea
from app.models.user import User


ALEJANDRO = "00000000-0000-0000-0000-000000000011"
SANDRA = "00000000-0000-0000-0000-000000000012"
ADMIN = "00000000-0000-0000-0000-000000000010"
CARLOS = "00000000-0000-0000-0000-000000000020"


@pytest_asyncio.fixture
async def case(client):
    response = await client.post("/api/v1/asuntos", json={"cliente_id": CARLOS, "abogado_id": ALEJANDRO})
    assert response.status_code == 201, response.text
    body = response.json()
    yield body
    response = await client.delete(f"/api/v1/asuntos/{body['id']}")
    assert response.status_code in {204, 404}


def task_payload(case, **extra):
    return {"asunto_id": case["id"], "titulo": "Solicitar certificado",
            "instruccion": "Obtener el certificado para revisión.", "responsable_id": SANDRA,
            "vence_en": "2026-10-07T09:00:00-05:00", **extra}


async def create_task(client, case, **extra):
    response = await client.post("/api/v1/tareas", json=task_payload(case, **extra))
    assert response.status_code == 201, response.text
    return response.json()


async def patch_task(client, task, **extra):
    return await client.patch(f"/api/v1/tareas/{task['id']}",
                              json={"expected_updated_at": task["updated_at"], **extra})


@pytest.mark.asyncio
async def test_owner_delegates_and_assistant_completes_without_advancing_case(
    case, client, alejandro_client, sandra_client, carlos_client, db_session,
):
    task = await create_task(alejandro_client, case)
    assert task["tipo"] == "tarea_interna"
    assert task["responsable"]["id"] == SANDRA
    mine = (await sandra_client.get("/api/v1/tareas/mi-trabajo")).json()
    assert task["id"] in {item["id"] for item in mine["items"]}
    progressed = await patch_task(sandra_client, task, estado="en_progreso")
    assert progressed.status_code == 200, progressed.text
    completed = await patch_task(sandra_client, progressed.json(), estado="completada")
    assert completed.status_code == 200, completed.text
    stored = await db_session.scalar(select(Tarea).where(Tarea.id == uuid.UUID(task["id"])))
    assert stored.started_at is not None and stored.completed_at is not None
    assert str(stored.completed_by_id) == SANDRA
    mine = (await sandra_client.get("/api/v1/tareas/mi-trabajo")).json()
    assert task["id"] not in {item["id"] for item in mine["items"]}
    reopened = await patch_task(alejandro_client, completed.json(), estado="pendiente")
    assert reopened.status_code == 200
    await db_session.refresh(stored)
    assert stored.completed_at is None and stored.completed_by_id is None
    detail = (await client.get(f"/api/v1/asuntos/{case['radicado']}")).json()
    assert detail["paso_actual"] == case["paso_actual"]
    assert (await carlos_client.get(f"/api/v1/novedades/asunto/{case['id']}")).json() == []


@pytest.mark.asyncio
async def test_task_manager_edits_and_stale_version_cannot_overwrite(case, client):
    task = await create_task(client, case)
    changed = await patch_task(client, task, responsable_id=ADMIN, prioridad="alta", vence_en=None)
    assert changed.status_code == 200, changed.text
    assert changed.json()["responsable"]["id"] == ADMIN
    assert changed.json()["vence_en"] is None
    stale = await patch_task(client, task, titulo="Edición antigua")
    assert stale.status_code == 409
    current = (await client.get(f"/api/v1/tareas/asunto/{case['id']}")).json()
    saved = next(item for item in current if item["id"] == task["id"])
    assert saved["titulo"] == task["titulo"] and saved["prioridad"] == "alta"


@pytest.mark.asyncio
async def test_concurrent_task_edits_return_success_and_conflict(case, client):
    task = await create_task(client, case)
    results = await asyncio.gather(patch_task(client, task, titulo="Primera"),
                                   patch_task(client, task, titulo="Segunda"))
    assert sorted(response.status_code for response in results) == [200, 409]


@pytest.mark.asyncio
async def test_assistant_cannot_delegate_edit_assignment_or_reopen(case, client, sandra_client):
    assert (await sandra_client.post("/api/v1/tareas", json=task_payload(case))).status_code == 403
    task = await create_task(client, case)
    assert (await patch_task(sandra_client, task, vence_en=None)).status_code == 403
    assert (await patch_task(sandra_client, task, responsable_id=ADMIN)).status_code == 403
    completed = await patch_task(sandra_client, task, estado="completada")
    assert completed.status_code == 200
    assert (await patch_task(sandra_client, completed.json(), estado="pendiente")).status_code == 409
    others = await create_task(client, case, responsable_id=ADMIN)
    assert (await patch_task(sandra_client, others, estado="completada")).status_code == 403


@pytest.mark.asyncio
async def test_derived_work_can_be_scheduled_but_only_completes_from_case(case, client):
    tasks = (await client.get(f"/api/v1/tareas/asunto/{case['id']}")).json()
    derived = next(task for task in tasks if task["tipo"] == "completar_paso")
    scheduled = await patch_task(client, derived, prioridad="urgente", vence_en="2026-10-09T12:00:00Z")
    assert scheduled.status_code == 200, scheduled.text
    for extra in [{"estado": "completada"}, {"responsable_id": SANDRA}, {"titulo": "Otro paso"}]:
        assert (await patch_task(client, scheduled.json(), **extra)).status_code == 409


@pytest.mark.asyncio
async def test_reassigning_case_preserves_manual_delegation(case, client):
    task = await create_task(client, case)
    own = await create_task(client, case, responsable_id=ALEJANDRO)
    response = await client.patch(f"/api/v1/asuntos/{case['id']}/responsable", json={"responsable_id": ADMIN})
    # Administradores también pueden asumir la responsabilidad operativa.
    assert response.status_code == 200, response.text
    tasks = (await client.get(f"/api/v1/tareas/asunto/{case['id']}")).json()
    assert next(item for item in tasks if item["id"] == task["id"])["responsable"]["id"] == SANDRA
    assert next(item for item in tasks if item["id"] == own["id"])["responsable"]["id"] == ADMIN
    assert next(item for item in tasks if item["tipo"] == "completar_paso")["responsable"]["id"] == ADMIN


@pytest.mark.asyncio
async def test_lawyer_without_case_access_cannot_read_or_mutate_tasks(case, client, alejandro_client):
    # La administración conserva el asunto; otro abogado no obtiene acceso por conocer un UUID.
    other = await client.post("/api/v1/asuntos", json={"cliente_id": CARLOS})
    assert other.status_code == 201
    matter = other.json()
    try:
        task = await create_task(client, matter)
        assert (await alejandro_client.get(f"/api/v1/tareas/asunto/{matter['id']}")).status_code == 404
        assert (await alejandro_client.post("/api/v1/tareas", json=task_payload(matter))).status_code == 404
        assert (await patch_task(alejandro_client, task, estado="completada")).status_code == 404
        invalid_assignee = await client.post("/api/v1/tareas", json=task_payload(matter, responsable_id=ALEJANDRO))
        assert invalid_assignee.status_code == 400
    finally:
        await client.delete(f"/api/v1/asuntos/{matter['id']}")


@pytest.mark.asyncio
async def test_task_routes_require_office_auth(case, client, carlos_client, anonymous_client):
    task = await create_task(client, case)
    for api, status in [(carlos_client, 403), (anonymous_client, 401)]:
        assert (await api.post("/api/v1/tareas", json=task_payload(case))).status_code == status
        assert (await api.get(f"/api/v1/tareas/asunto/{case['id']}")).status_code == status
        assert (await patch_task(api, task, estado="completada")).status_code == status


@pytest.mark.asyncio
@pytest.mark.parametrize("extra", [{"titulo": " "}, {"instruccion": None}, {"prioridad": "inmediata"},
                                  {"vence_en": "2026-10-07T09:00:00"}, {"campo_extra": True}])
async def test_creation_rejects_invalid_task_data(case, client, extra):
    assert (await client.post("/api/v1/tareas", json=task_payload(case, **extra))).status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize("extra", [{"titulo": None}, {"responsable_id": None}, {"estado": "cerrada"},
                                  {"expected_updated_at": None}, {"vence_en": "2026-10-07"}, {"extra": True}])
async def test_update_rejects_invalid_task_data(case, client, extra):
    task = await create_task(client, case)
    assert (await patch_task(client, task, **extra)).status_code == 422


@pytest.mark.asyncio
async def test_missing_assignee_and_archived_or_missing_task_are_not_found(case, client):
    for assignee in [str(uuid.uuid4()), CARLOS]:
        assert (await client.post("/api/v1/tareas", json=task_payload(case, responsable_id=assignee))).status_code == 404
    task = await create_task(client, case)
    absent = {**task, "id": str(uuid.uuid4())}
    assert (await patch_task(client, absent, estado="completada")).status_code == 404
    assert (await client.get(f"/api/v1/tareas/asunto/{uuid.uuid4()}")).status_code == 404
    assert (await client.delete(f"/api/v1/asuntos/{case['id']}")).status_code == 204
    assert (await patch_task(client, task, estado="completada")).status_code == 404


@pytest.mark.asyncio
async def test_office_directory_excludes_clients_and_rejects_public_access(client, sandra_client, carlos_client, anonymous_client):
    response = await sandra_client.get("/api/v1/equipo/miembros")
    assert response.status_code == 200
    assert {row["id"] for row in response.json()} == {ADMIN, ALEJANDRO, SANDRA}
    assert all(set(row) == {"id", "nombre", "rol"} for row in response.json())
    assert (await carlos_client.get("/api/v1/equipo/miembros")).status_code == 403
    assert (await anonymous_client.get("/api/v1/equipo/miembros")).status_code == 401


@pytest.mark.asyncio
async def test_other_firm_cannot_read_delegate_or_edit_case_work(case, client, db_session):
    suffix = uuid.uuid4().hex
    firma = Firma(id=uuid.uuid4(), nombre="Firma de prueba aislada", subdominio=f"test-{suffix}")
    db_session.add(firma)
    await db_session.flush()
    actor = User(id=uuid.uuid4(), firma_id=firma.id, nombre="Administrador de otra firma",
                 email=f"admin-{suffix}@example.com", cedula=suffix, rol="administrador",
                 hashed_password=get_password_hash("test-only-password"))
    db_session.add(actor)
    await db_session.commit()
    task = await create_task(client, case)
    assert (await client.post("/api/v1/tareas", json=task_payload(case, responsable_id=str(actor.id)))).status_code == 404
    assert str(actor.id) not in {row["id"] for row in (await client.get("/api/v1/equipo/miembros")).json()}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as other:
        login = await other.post("/api/v1/auth/login", json={
            "firma_slug": firma.subdominio, "email": actor.email, "password": "test-only-password"})
        assert login.status_code == 200, login.text
        assert (await other.get(f"/api/v1/tareas/asunto/{case['id']}")).status_code == 404
        assert (await other.post("/api/v1/tareas", json=task_payload(case))).status_code == 404
        assert (await patch_task(other, task, estado="completada")).status_code == 404
        assert (await other.get("/api/v1/tareas/mi-trabajo", params={"alcance": "equipo"})).json() == {"items": [], "total": 0}
        assert (await other.get("/api/v1/tareas/agenda", params={
            "alcance": "equipo", "desde": "2026-10-01T00:00:00Z", "hasta": "2026-10-30T00:00:00Z"})).json() == {"items": [], "total": 0}
    actor.is_active = False
    firma.is_active = False
    await db_session.commit()
