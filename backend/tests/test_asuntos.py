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
    Prueba actualizar el próximo paso de un asunto existente.
    """
    asunto_id = "00000000-0000-0000-0000-000000000201"
    response = await client.patch(
        f"/api/v1/asuntos/{asunto_id}/estado",
        json={"siguiente_paso": "Fijar fecha de audiencia en tribunal"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["siguiente_paso"] == "Fijar fecha de audiencia en tribunal"

@pytest.mark.asyncio
async def test_update_estado_asunto_not_found(client):
    """
    [CASO BORDE / ERROR] Intentar actualizar un asunto con UUID que no existe debe retornar 404.
    """
    random_uuid = str(uuid.uuid4())
    response = await client.patch(
        f"/api/v1/asuntos/{random_uuid}/estado",
        json={"siguiente_paso": "Paso inválido"}
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
        "etapa_actual": "Etapa 1",
        "siguiente_paso": "Borrado de prueba"
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
