import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models.asunto_paso import AsuntoPaso


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
async def test_create_case_starts_with_seven_sequential_steps(client):
    asunto = await create_case(client, uuid.uuid4().hex[:8])

    assert asunto["paso_actual"] == 1
    assert asunto["flujo_estado"] == "activo"
    assert asunto["ruta_codigo"] == "insolvencia_persona_natural:v2"
    assert asunto["etapa_actual"] == "Paso 1 de 7: Recepción y evaluación inicial"
    assert asunto["abogado_id"] == "00000000-0000-0000-0000-000000000010"
    assert len(asunto["pasos"]) == 7
    assert [paso["estado"] for paso in asunto["pasos"]] == [
        "activo",
        "bloqueado",
        "bloqueado",
        "bloqueado",
        "bloqueado",
        "bloqueado",
        "bloqueado",
    ]


@pytest.mark.asyncio
async def test_create_case_assigns_an_internal_code_when_not_provided(client):
    response = await client.post(
        "/api/v1/asuntos",
        json={"cliente_id": CLIENTE_CARLOS_ID},
    )

    assert response.status_code == 201, response.text
    assert response.json()["radicado"].startswith("AS-")


@pytest.mark.asyncio
async def test_create_case_derives_the_initial_next_action_from_the_route(client):
    response = await client.post(
        "/api/v1/asuntos",
        json={
            "cliente_id": CLIENTE_CARLOS_ID,
            "fecha_apertura": "2026-07-15",
        },
    )

    assert response.status_code == 201, response.text
    assert response.json()["siguiente_paso"].startswith("Verifica identidad")
    assert response.json()["fecha_apertura"] == "2026-07-15"


@pytest.mark.asyncio
async def test_workflow_validates_data_and_prevents_skipping(client):
    asunto = await create_case(client, uuid.uuid4().hex[:8])
    endpoint = f"/api/v1/asuntos/{asunto['id']}/flujo/avanzar"

    invalid = await client.post(
        endpoint,
        json={
            "paso_codigo": "recepcion_evaluacion",
            "datos": {"identidad_verificada": False},
        },
    )
    assert invalid.status_code == 400
    assert "obligatorio" in invalid.json()["detail"]

    skipped = await client.post(
        endpoint,
        json={"paso_codigo": "agendar_audiencia", "datos": {}},
    )
    assert skipped.status_code == 409
    assert "Recepción y evaluación inicial" in skipped.json()["detail"]

    advanced = await client.post(
        endpoint,
        json={
            "paso_codigo": "recepcion_evaluacion",
            "datos": {
                "identidad_verificada": True,
                "conflicto_interes": "sin_conflicto",
                "viabilidad_preliminar": "viable",
                "observaciones": "La información inicial permite continuar.",
            },
        },
    )
    assert advanced.status_code == 200, advanced.text
    body = advanced.json()
    assert body["paso_actual"] == 2
    assert body["pasos"][0]["estado"] == "completado"
    assert body["pasos"][1]["estado"] == "activo"
    assert body["pasos"][0]["datos"]["identidad_verificada"] is True
    activity = await client.get(f"/api/v1/novedades/asunto/{asunto['id']}")
    step_event = next(
        item for item in activity.json() if item["tipo"] == "paso_completado"
    )
    assert step_event["asunto_paso_id"] == asunto["pasos"][0]["id"]
    assert step_event["publicado_al_cliente"] is False


@pytest.mark.asyncio
async def test_workflow_can_complete_all_steps(client):
    asunto = await create_case(client, uuid.uuid4().hex[:8])
    endpoint = f"/api/v1/asuntos/{asunto['id']}/flujo/avanzar"
    steps = [
        (
            "recepcion_evaluacion",
            {
                "identidad_verificada": True,
                "conflicto_interes": "sin_conflicto",
                "viabilidad_preliminar": "viable",
                "observaciones": "Recepción completa.",
            },
        ),
        (
            "preparacion_solicitud",
            {
                "documentacion_completa": True,
                "solicitud_revisada": True,
                "observaciones": "Solicitud lista para radicar.",
            },
        ),
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
    assert body["paso_actual"] == 7
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
        json={"paso_codigo": "recepcion_evaluacion", "datos": {}},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_lawyer_cannot_advance_another_lawyers_work(alejandro_client):
    response = await alejandro_client.post(
        "/api/v1/asuntos/00000000-0000-0000-0000-000000000201/flujo/avanzar",
        json={
            "paso_codigo": "recepcion_evaluacion",
            "datos": {
                "identidad_verificada": True,
                "conflicto_interes": "sin_conflicto",
                "viabilidad_preliminar": "viable",
                "observaciones": "Intento sin asignación.",
            },
        },
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Esta tarea está asignada a otro responsable"


@pytest.mark.asyncio
async def test_workflow_stops_when_conflict_requires_review(client):
    asunto = await create_case(client, uuid.uuid4().hex[:8])
    response = await client.post(
        f"/api/v1/asuntos/{asunto['id']}/flujo/avanzar",
        json={
            "paso_codigo": "recepcion_evaluacion",
            "datos": {
                "identidad_verificada": True,
                "conflicto_interes": "requiere_revision",
                "viabilidad_preliminar": "viable",
                "observaciones": "Existe una coincidencia por revisar.",
            },
        },
    )

    assert response.status_code == 409
    assert "conflicto" in response.json()["detail"]
    detail = await client.get(f"/api/v1/asuntos/{asunto['radicado']}")
    assert detail.json()["paso_actual"] == 1


@pytest.mark.asyncio
async def test_workflow_stops_when_viability_is_not_confirmed(client):
    asunto = await create_case(client, uuid.uuid4().hex[:8])
    response = await client.post(
        f"/api/v1/asuntos/{asunto['id']}/flujo/avanzar",
        json={
            "paso_codigo": "recepcion_evaluacion",
            "datos": {
                "identidad_verificada": True,
                "conflicto_interes": "sin_conflicto",
                "viabilidad_preliminar": "informacion_insuficiente",
                "observaciones": "Faltan soportes para concluir.",
            },
        },
    )

    assert response.status_code == 409
    assert "viabilidad" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_case_rejects_duplicate_radicado(client):
    radicado = f"TEST-FLUJO-{uuid.uuid4().hex[:8]}"
    payload = {"radicado": radicado, "cliente_id": CLIENTE_CARLOS_ID}
    assert (await client.post("/api/v1/asuntos", json=payload)).status_code == 201
    duplicate = await client.post("/api/v1/asuntos", json=payload)
    assert duplicate.status_code == 400


@pytest.mark.asyncio
async def test_database_prevents_two_active_steps_for_one_case(client, db_session):
    asunto = await create_case(client, uuid.uuid4().hex[:8])
    result = await db_session.execute(
        select(AsuntoPaso)
        .where(AsuntoPaso.asunto_id == uuid.UUID(asunto["id"]))
        .where(AsuntoPaso.orden == 2)
    )
    second_step = result.scalar_one()
    second_step.estado = "activo"

    with pytest.raises(IntegrityError):
        await db_session.commit()
