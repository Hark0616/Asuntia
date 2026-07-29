import uuid

import pytest


CLIENTE_CARLOS_ID = "00000000-0000-0000-0000-000000000020"


async def create_case(client):
    response = await client.post(
        "/api/v1/asuntos",
        json={
            "radicado": f"TEST-TAREA-{uuid.uuid4().hex[:8]}",
            "cliente_id": CLIENTE_CARLOS_ID,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_opening_case_creates_initial_work_item(client):
    asunto = await create_case(client)

    response = await client.get("/api/v1/tareas/mi-trabajo")

    assert response.status_code == 200, response.text
    body = response.json()
    tarea = next(
        item for item in body["items"] if item["asunto"]["id"] == asunto["id"]
    )
    assert tarea["titulo"] == "Completar recepción y evaluación inicial"
    assert tarea["estado"] == "pendiente"
    assert tarea["asunto"]["cliente"]["nombre"] == "Carlos Gómez Restrepo"
    assert tarea["responsable"]["nombre"] == "Dra. Daniela Torres"


@pytest.mark.asyncio
async def test_advancing_workflow_replaces_open_work_item(client):
    asunto = await create_case(client)
    advanced = await client.post(
        f"/api/v1/asuntos/{asunto['id']}/flujo/avanzar",
        json={
            "paso_codigo": "recepcion_evaluacion",
            "datos": {
                "identidad_verificada": True,
                "conflicto_interes": "sin_conflicto",
                "viabilidad_preliminar": "viable",
                "observaciones": "Recepción completa.",
            },
        },
    )
    assert advanced.status_code == 200, advanced.text

    response = await client.get("/api/v1/tareas/mi-trabajo")

    assert response.status_code == 200, response.text
    matter_items = [
        item
        for item in response.json()["items"]
        if item["asunto"]["id"] == asunto["id"]
    ]
    assert len(matter_items) == 1
    assert matter_items[0]["titulo"] == "Completar preparación de la solicitud"
    assert matter_items[0]["estado"] == "pendiente"


@pytest.mark.asyncio
async def test_administrator_can_view_team_work(client):
    mine = await client.get("/api/v1/tareas/mi-trabajo")
    team = await client.get("/api/v1/tareas/mi-trabajo?alcance=equipo")

    assert mine.status_code == 200
    assert team.status_code == 200
    assert team.json()["total"] > mine.json()["total"]


@pytest.mark.asyncio
async def test_lawyer_cannot_view_team_work(alejandro_client):
    response = await alejandro_client.get(
        "/api/v1/tareas/mi-trabajo?alcance=equipo"
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_client_and_anonymous_user_cannot_view_office_work(
    carlos_client, anonymous_client
):
    assert (await carlos_client.get("/api/v1/tareas/mi-trabajo")).status_code == 403
    assert (await anonymous_client.get("/api/v1/tareas/mi-trabajo")).status_code == 401


@pytest.mark.asyncio
async def test_work_scope_is_validated(client):
    response = await client.get("/api/v1/tareas/mi-trabajo?alcance=desconocido")
    assert response.status_code == 422
