import uuid

import pytest


DANIELA_ID = "00000000-0000-0000-0000-000000000010"
ALEJANDRO_ID = "00000000-0000-0000-0000-000000000011"
PORTAL_CARLOS_ID = "00000000-0000-0000-0000-000000000020"


async def create_client(api_client, prefix: str = "Asignación"):
    suffix = uuid.uuid4().hex[:8]
    response = await api_client.post(
        "/api/v1/clientes",
        json={
            "nombre": f"{prefix} {suffix}",
            "numero_documento": f"91{suffix[:6]}",
            "email": f"asignacion.{suffix}@example.com",
            "habilitar_portal": False,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_administrator_assigns_client_without_changing_its_cases(client):
    created_client = await create_client(client)
    created_case = await client.post(
        "/api/v1/asuntos",
        json={"cliente_id": created_client["id"]},
    )
    assert created_case.status_code == 201, created_case.text

    response = await client.patch(
        f"/api/v1/clientes/{created_client['id']}/responsable",
        json={"responsable_id": ALEJANDRO_ID},
    )

    assert response.status_code == 200, response.text
    assert response.json()["responsable_id"] == ALEJANDRO_ID
    assert response.json()["asuntos_count"] == 1
    assert created_case.json()["abogado_id"] == DANIELA_ID


@pytest.mark.asyncio
async def test_assistant_can_assign_a_client(sandra_client):
    created_client = await create_client(
        sandra_client,
        prefix="Cliente de auxiliar",
    )
    assert created_client["responsable_id"] is None

    response = await sandra_client.patch(
        f"/api/v1/clientes/{created_client['id']}/responsable",
        json={"responsable_id": DANIELA_ID},
    )

    assert response.status_code == 200, response.text
    assert response.json()["responsable_id"] == DANIELA_ID


@pytest.mark.asyncio
async def test_reassigning_case_moves_all_open_work_to_new_lawyer(
    client,
    sandra_client,
    alejandro_client,
):
    created_client = await create_client(client, prefix="Transferencia")
    created_case = await client.post(
        "/api/v1/asuntos",
        json={"cliente_id": created_client["id"]},
    )
    assert created_case.status_code == 201, created_case.text
    case_id = created_case.json()["id"]

    response = await sandra_client.patch(
        f"/api/v1/asuntos/{case_id}/responsable",
        json={"responsable_id": ALEJANDRO_ID},
    )

    assert response.status_code == 200, response.text
    assert response.json()["abogado_id"] == ALEJANDRO_ID

    work = await alejandro_client.get("/api/v1/tareas/mi-trabajo")
    assert work.status_code == 200, work.text
    transferred = next(
        item
        for item in work.json()["items"]
        if item["asunto"]["id"] == case_id
    )
    assert transferred["responsable"]["id"] == ALEJANDRO_ID

    clients = await client.get("/api/v1/clientes")
    client_record = next(
        item
        for item in clients.json()
        if item["id"] == created_client["id"]
    )
    assert client_record["responsable_id"] == DANIELA_ID


@pytest.mark.asyncio
async def test_assignment_to_same_responsible_is_idempotent(client):
    created_client = await create_client(client, prefix="Idempotencia")

    first = await client.patch(
        f"/api/v1/clientes/{created_client['id']}/responsable",
        json={"responsable_id": DANIELA_ID},
    )
    second = await client.patch(
        f"/api/v1/clientes/{created_client['id']}/responsable",
        json={"responsable_id": DANIELA_ID},
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["responsable_id"] == DANIELA_ID


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/clientes/00000000-0000-0000-0000-000000000020/responsable",
        "/api/v1/asuntos/00000000-0000-0000-0000-000000000202/responsable",
    ],
)
async def test_regular_lawyer_cannot_transfer_assignments(
    alejandro_client,
    path,
):
    response = await alejandro_client.patch(
        path,
        json={"responsable_id": DANIELA_ID},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/clientes/00000000-0000-0000-0000-000000000020/responsable",
        "/api/v1/asuntos/00000000-0000-0000-0000-000000000201/responsable",
    ],
)
async def test_client_and_anonymous_cannot_transfer_assignments(
    carlos_client,
    anonymous_client,
    path,
):
    payload = {"responsable_id": ALEJANDRO_ID}
    assert (await carlos_client.patch(path, json=payload)).status_code == 403
    assert (await anonymous_client.patch(path, json=payload)).status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("path", "detail"),
    [
        (
            f"/api/v1/clientes/{uuid.uuid4()}/responsable",
            "Cliente no encontrado",
        ),
        (
            f"/api/v1/asuntos/{uuid.uuid4()}/responsable",
            "Asunto no encontrado",
        ),
    ],
)
async def test_assignment_rejects_missing_business_record(
    client,
    path,
    detail,
):
    response = await client.patch(
        path,
        json={"responsable_id": ALEJANDRO_ID},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == detail


@pytest.mark.asyncio
async def test_assignment_rejects_client_as_responsible(client):
    created_client = await create_client(client, prefix="Destino inválido")

    response = await client.patch(
        f"/api/v1/clientes/{created_client['id']}/responsable",
        json={"responsable_id": PORTAL_CARLOS_ID},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Responsable no encontrado"
