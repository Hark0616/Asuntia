"""Una agenda proyectada desde las fechas originales, con aislamiento de acceso."""
import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select, update

from app.models.asunto import Asunto
from app.models.asunto_paso import AsuntoPaso
from app.models.tarea import Tarea


ALEJANDRO = "00000000-0000-0000-0000-000000000011"
SANDRA = "00000000-0000-0000-0000-000000000012"
CARLOS = "00000000-0000-0000-0000-000000000020"
WINDOW = {"desde": "2026-10-05T00:00:00-05:00", "hasta": "2026-10-12T00:00:00-05:00"}


@pytest_asyncio.fixture
async def case(client):
    response = await client.post("/api/v1/asuntos", json={"cliente_id": CARLOS, "abogado_id": ALEJANDRO})
    assert response.status_code == 201
    body = response.json()
    yield body
    await client.delete(f"/api/v1/asuntos/{body['id']}")


async def make_task(client, case, when, **extra):
    response = await client.post("/api/v1/tareas", json={
        "asunto_id": case["id"], "titulo": "Revisar certificado", "instruccion": "Revisar el soporte.",
        "responsable_id": SANDRA, "vence_en": when, **extra})
    assert response.status_code == 201, response.text
    return response.json()


async def hearing(db_session, case, when):
    paso = await db_session.scalar(select(AsuntoPaso).where(
        AsuntoPaso.asunto_id == uuid.UUID(case["id"]), AsuntoPaso.codigo == "agendar_audiencia"))
    paso.datos = {"fecha_hora": when, "modalidad": "virtual"}
    await db_session.commit()
    return paso


@pytest.mark.asyncio
async def test_agenda_combines_original_dates_and_limits_without_losing_total(case, client, sandra_client, alejandro_client, db_session):
    task = await make_task(client, case, "2026-10-07T09:00:00-05:00")
    paso = await hearing(db_session, case, "2026-10-08T10:00:00-05:00")
    mine = (await sandra_client.get("/api/v1/tareas/agenda", params=WINDOW)).json()
    assert f"tarea:{task['id']}" in {item["id"] for item in mine["items"]}
    assert f"audiencia:{paso.id}" not in {item["id"] for item in mine["items"]}
    lawyer = (await alejandro_client.get("/api/v1/tareas/agenda", params=WINDOW)).json()
    assert f"audiencia:{paso.id}" in {item["id"] for item in lawyer["items"]}
    team = await client.get("/api/v1/tareas/agenda", params={**WINDOW, "alcance": "equipo"})
    assert team.status_code == 200, team.text
    matching = [item for item in team.json()["items"] if item["asunto"]["id"] == case["id"]]
    assert [item["id"] for item in matching] == [f"tarea:{task['id']}", f"audiencia:{paso.id}"]
    limited = (await client.get("/api/v1/tareas/agenda", params={**WINDOW, "alcance": "equipo", "limit": 1})).json()
    assert len(limited["items"]) == 1 and limited["total"] == team.json()["total"]
    assert limited["total"] > len(limited["items"])
    # La proyección muestra la modificación del dato original, con el mismo identificador.
    paso.datos = {"fecha_hora": "2026-10-09T11:00:00-05:00"}
    await db_session.commit()
    current = (await alejandro_client.get("/api/v1/tareas/agenda", params=WINDOW)).json()
    item = next(item for item in current["items"] if item["id"] == f"audiencia:{paso.id}")
    assert item["fecha"].startswith("2026-10-09T11:00:00")


@pytest.mark.asyncio
async def test_legacy_hearing_without_offset_uses_colombian_time(case, alejandro_client, db_session):
    paso = await hearing(db_session, case, "2026-10-07T09:00:00")
    response = await alejandro_client.get("/api/v1/tareas/agenda", params={
        "desde": "2026-10-07T13:59:00Z", "hasta": "2026-10-07T14:01:00Z"})
    assert response.status_code == 200, response.text
    item = next(item for item in response.json()["items"] if item["id"] == f"audiencia:{paso.id}")
    assert item["fecha"] == "2026-10-07T09:00:00-05:00"


@pytest.mark.asyncio
async def test_agenda_excludes_completed_and_unscheduled_work_and_archived_cases(case, client, sandra_client, db_session):
    completed = await make_task(client, case, "2026-10-07T09:00:00-05:00")
    response = await sandra_client.patch(f"/api/v1/tareas/{completed['id']}", json={
        "expected_updated_at": completed["updated_at"], "estado": "completada"})
    assert response.status_code == 200
    unscheduled = await make_task(client, case, None)
    outside = await make_task(client, case, "2026-11-01T09:00:00-05:00")
    agenda = (await sandra_client.get("/api/v1/tareas/agenda", params=WINDOW)).json()
    ids = {item["id"] for item in agenda["items"]}
    assert all(f"tarea:{task['id']}" not in ids for task in [completed, unscheduled, outside])
    active = await make_task(client, case, "2026-10-10T09:00:00-05:00")
    await hearing(db_session, case, "2026-10-08T10:00:00-05:00")
    assert (await client.delete(f"/api/v1/asuntos/{case['id']}")).status_code == 204
    agenda = (await client.get("/api/v1/tareas/agenda", params={**WINDOW, "alcance": "equipo"})).json()
    assert all(item["asunto"]["id"] != case["id"] for item in agenda["items"])


@pytest.mark.asyncio
async def test_old_lawyer_cannot_see_inconsistent_historical_task_after_case_transfer(case, client, alejandro_client, db_session):
    task = await make_task(client, case, "2026-10-07T09:00:00-05:00", responsable_id=ALEJANDRO)
    # Simula un registro legado inconsistente; las lecturas siguen respetando el acceso al asunto.
    await db_session.execute(update(Asunto).where(Asunto.id == uuid.UUID(case["id"])).values(
        abogado_id=uuid.UUID("00000000-0000-0000-0000-000000000010")))
    await db_session.commit()
    work = (await alejandro_client.get("/api/v1/tareas/mi-trabajo")).json()
    assert task["id"] not in {item["id"] for item in work["items"]}
    agenda = (await alejandro_client.get("/api/v1/tareas/agenda", params=WINDOW)).json()
    assert f"tarea:{task['id']}" not in {item["id"] for item in agenda["items"]}


@pytest.mark.asyncio
async def test_inactive_hearing_is_omitted(case, client, db_session):
    paso = await hearing(db_session, case, "2026-10-08T10:00:00-05:00")
    paso.is_active = False
    await db_session.commit()
    response = await client.get("/api/v1/tareas/agenda", params={**WINDOW, "alcance": "equipo"})
    assert response.status_code == 200
    assert f"audiencia:{paso.id}" not in {item["id"] for item in response.json()["items"]}


@pytest.mark.asyncio
async def test_agenda_access_and_window_validation(client, alejandro_client, sandra_client, carlos_client, anonymous_client):
    for api in [alejandro_client, sandra_client]:
        assert (await api.get("/api/v1/tareas/agenda", params={"alcance": "equipo"})).status_code == 403
    assert (await carlos_client.get("/api/v1/tareas/agenda")).status_code == 403
    assert (await anonymous_client.get("/api/v1/tareas/agenda")).status_code == 401
    for params in [{"alcance": "extra"}, {"desde": "2026-10-07"}, {"limit": 0}]:
        assert (await client.get("/api/v1/tareas/agenda", params=params)).status_code == 422
    for end in ["2026-10-05T00:00:00-05:00", "2027-10-05T00:00:00-05:00"]:
        assert (await client.get("/api/v1/tareas/agenda", params={**WINDOW, "hasta": end})).status_code == 400
    empty = await client.get("/api/v1/tareas/agenda", params={"desde": "2099-01-01T00:00:00Z", "hasta": "2099-01-02T00:00:00Z"})
    assert empty.status_code == 200 and empty.json() == {"items": [], "total": 0}
