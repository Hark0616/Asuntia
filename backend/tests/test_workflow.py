import uuid

import pytest


CLIENTE_CARLOS_ID = "00000000-0000-0000-0000-000000000020"


async def create_case(client, suffix: str):
    response = await client.post(
        "/api/v1/asuntos",
        json={
            "radicado": f"TEST-FLUJO-{suffix}",
            "cliente_id": CLIENTE_CARLOS_ID,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_create_case_starts_with_five_sequential_steps(client):
    asunto = await create_case(client, uuid.uuid4().hex[:8])

    assert asunto["paso_actual"] == 1
    assert asunto["flujo_estado"] == "activo"
    assert asunto["etapa_actual"] == "Paso 1 de 5: Radicación"
    assert asunto["abogado_id"] == "00000000-0000-0000-0000-000000000010"
    assert len(asunto["pasos"]) == 5
    assert [paso["estado"] for paso in asunto["pasos"]] == [
        "activo",
        "bloqueado",
        "bloqueado",
        "bloqueado",
        "bloqueado",
    ]


@pytest.mark.asyncio
async def test_workflow_validates_data_and_prevents_skipping(client):
    asunto = await create_case(client, uuid.uuid4().hex[:8])
    endpoint = f"/api/v1/asuntos/{asunto['id']}/flujo/avanzar"

    invalid = await client.post(
        endpoint,
        json={"paso_codigo": "radicacion", "datos": {"radicado_oficial": ""}},
    )
    assert invalid.status_code == 400
    assert "obligatorio" in invalid.json()["detail"]

    skipped = await client.post(
        endpoint,
        json={"paso_codigo": "agendar_audiencia", "datos": {}},
    )
    assert skipped.status_code == 409
    assert "Radicación" in skipped.json()["detail"]

    advanced = await client.post(
        endpoint,
        json={
            "paso_codigo": "radicacion",
            "datos": {
                "radicado_oficial": "RAD-2026-900",
                "autoridad": "Centro de Conciliación",
                "fecha_radicacion": "2026-07-28",
            },
        },
    )
    assert advanced.status_code == 200, advanced.text
    body = advanced.json()
    assert body["paso_actual"] == 2
    assert body["pasos"][0]["estado"] == "completado"
    assert body["pasos"][1]["estado"] == "activo"
    assert body["pasos"][0]["datos"]["radicado_oficial"] == "RAD-2026-900"


@pytest.mark.asyncio
async def test_workflow_can_complete_all_steps(client):
    asunto = await create_case(client, uuid.uuid4().hex[:8])
    endpoint = f"/api/v1/asuntos/{asunto['id']}/flujo/avanzar"
    steps = [
        (
            "radicacion",
            {
                "radicado_oficial": "RAD-2026-901",
                "autoridad": "Notaría 12",
                "fecha_radicacion": "2026-07-28",
            },
        ),
        (
            "agendar_audiencia",
            {
                "fecha_hora": "2026-08-05T09:00",
                "modalidad": "virtual",
                "enlace_o_lugar": "https://meet.google.com/demo",
            },
        ),
        ("audiencia_agendada", {"audiencia_realizada": True}),
        (
            "resultado_audiencia",
            {"resumen": "Se revisaron las acreencias.", "resultado": "acuerdo"},
        ),
        (
            "definicion",
            {"definicion": "acuerdo", "observaciones": "Acuerdo confirmado."},
        ),
    ]

    for code, data in steps:
        response = await client.post(
            endpoint,
            json={"paso_codigo": code, "datos": data},
        )
        assert response.status_code == 200, response.text

    body = response.json()
    assert body["flujo_estado"] == "completado"
    assert body["paso_actual"] == 5
    assert all(paso["estado"] == "completado" for paso in body["pasos"])

    repeated = await client.post(
        endpoint,
        json={"paso_codigo": "definicion", "datos": steps[-1][1]},
    )
    assert repeated.status_code == 409


@pytest.mark.asyncio
async def test_client_cannot_advance_workflow(carlos_client):
    response = await carlos_client.post(
        "/api/v1/asuntos/00000000-0000-0000-0000-000000000201/flujo/avanzar",
        json={"paso_codigo": "radicacion", "datos": {}},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_create_case_rejects_duplicate_radicado(client):
    radicado = f"TEST-FLUJO-{uuid.uuid4().hex[:8]}"
    payload = {"radicado": radicado, "cliente_id": CLIENTE_CARLOS_ID}
    assert (await client.post("/api/v1/asuntos", json=payload)).status_code == 201
    duplicate = await client.post("/api/v1/asuntos", json=payload)
    assert duplicate.status_code == 400
