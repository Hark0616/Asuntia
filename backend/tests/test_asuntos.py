import pytest
import uuid

@pytest.mark.asyncio
async def test_list_asuntos(client):
    """
    Prueba listar los asuntos activos.
    """
    response = await client.get("/api/v1/asuntos")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

@pytest.mark.asyncio
async def test_get_asunto_by_radicado_success(client):
    """
    Prueba obtener un asunto por su número de radicado existente.
    """
    response = await client.get("/api/v1/asuntos/AS-2026-001")
    assert response.status_code == 200
    data = response.json()
    assert data["radicado"] == "AS-2026-001"

@pytest.mark.asyncio
async def test_get_asunto_not_found(client):
    """
    [CASO BORDE / ERROR] Buscar un radicado que NO existe debe retornar 404.
    """
    response = await client.get("/api/v1/asuntos/AS-9999-INEXISTENTE")
    assert response.status_code == 404
    assert response.json()["detail"] == "No se encontró el asunto con radicado AS-9999-INEXISTENTE"

@pytest.mark.asyncio
async def test_update_estado_asunto_success(client):
    """
    Prueba actualizar el estado procesal de un asunto existente.
    """
    asunto_id = "00000000-0000-0000-0000-000000000201"
    estado_id = "00000000-0000-0000-0000-000000000102"
    response = await client.patch(
        f"/api/v1/asuntos/{asunto_id}/estado",
        json={"estado_id": estado_id}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["estado"]["id"] == estado_id
    assert data["etapa_actual"] == "Paso 1 de 7: Recepción y evaluación inicial"

@pytest.mark.asyncio
async def test_update_estado_asunto_not_found(client):
    """
    [CASO BORDE / ERROR] Intentar actualizar un asunto con UUID que no existe debe retornar 404.
    """
    random_uuid = str(uuid.uuid4())
    response = await client.patch(
        f"/api/v1/asuntos/{random_uuid}/estado",
        json={"estado_id": "00000000-0000-0000-0000-000000000102"}
    )
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_delete_asunto_not_found(client):
    """
    [CASO BORDE / ERROR] Intentar eliminar un asunto inexistente debe retornar 404.
    """
    random_uuid = str(uuid.uuid4())
    response = await client.delete(f"/api/v1/asuntos/{random_uuid}")
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_create_and_soft_delete_asunto(client):
    """
    [FLUJO COMPLETO & SOFT DELETE] Crear un asunto y luego realizar borrado lógico.
    """
    radicado_test = f"AS-TEST-DEL-{uuid.uuid4().hex[:4]}"
    create_payload = {
        "radicado": radicado_test,
        "cliente_id": "00000000-0000-0000-0000-000000000020",
    }
    # 1. Crear
    res_create = await client.post("/api/v1/asuntos", json=create_payload)
    assert res_create.status_code == 201
    asunto_id = res_create.json()["id"]

    # 2. Borrar (Soft Delete)
    res_del = await client.delete(f"/api/v1/asuntos/{asunto_id}")
    assert res_del.status_code == 204

    # 3. Confirmar que ya no se encuentra activamente
    res_get = await client.get(f"/api/v1/asuntos/{radicado_test}")
    assert res_get.status_code == 404


@pytest.mark.asyncio
async def test_open_case_with_existing_client(client):
    response = await client.post(
        "/api/v1/asuntos/apertura",
        json={
            "cliente_id": "00000000-0000-0000-0000-000000000020",
            "abogado_id": "00000000-0000-0000-0000-000000000011",
            "fecha_apertura": "2026-07-29",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["cliente_id"] == "00000000-0000-0000-0000-000000000020"
    assert data["abogado_id"] == "00000000-0000-0000-0000-000000000011"
    assert data["paso_actual"] == 1


@pytest.mark.asyncio
async def test_open_case_creates_complete_new_client_atomically(client):
    suffix = uuid.uuid4().hex[:8]
    response = await client.post(
        "/api/v1/asuntos/apertura",
        json={
            "cliente_nuevo": {
                "tipo_persona": "natural",
                "tipo_documento": "CC",
                "numero_documento": f"88{suffix[:6]}",
                "nombre": f"Cliente desde apertura {suffix}",
                "email": f"apertura.{suffix}@example.com",
                "telefono": "300 555 0199",
                "direccion": "Calle 45 # 20-18",
                "ciudad": "Bucaramanga",
                "departamento": "Santander",
                "canal_preferido": "whatsapp",
            },
            "fecha_apertura": "2026-07-29",
        },
    )

    assert response.status_code == 201
    client_id = response.json()["cliente_id"]
    listed_clients = await client.get("/api/v1/clientes")
    created_client = next(
        item for item in listed_clients.json() if item["id"] == client_id
    )
    assert created_client["direccion"] == "Calle 45 # 20-18"
    assert created_client["canal_preferido"] == "whatsapp"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {},
        {
            "cliente_id": "00000000-0000-0000-0000-000000000020",
            "cliente_nuevo": {
                "numero_documento": "123456789",
                "nombre": "Fuente ambigua",
                "email": "ambigua@example.com",
            },
        },
    ],
)
async def test_open_case_requires_exactly_one_client_source(client, payload):
    response = await client.post("/api/v1/asuntos/apertura", json=payload)

    assert response.status_code == 422
