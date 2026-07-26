import pytest
import uuid

@pytest.mark.asyncio
async def test_list_novedades_success(client):
    """
    Prueba listar el historial de novedades de un asunto existente.
    """
    asunto_id = "00000000-0000-0000-0000-000000000201"
    response = await client.get(f"/api/v1/novedades/asunto/{asunto_id}")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

@pytest.mark.asyncio
async def test_create_and_delete_novedad(client):
    """
    Prueba publicar una novedad y luego realizar borrado lógico.
    """
    asunto_id = "00000000-0000-0000-0000-000000000201"
    payload = {
        "titulo": "Prueba Novedad Novedosa",
        "descripcion": "Detalle del avance de prueba automatizada",
        "publicado_al_cliente": True
    }
    # 1. Crear Novedad
    res_create = await client.post(f"/api/v1/novedades/asunto/{asunto_id}", json=payload)
    assert res_create.status_code == 201
    novedad_data = res_create.json()
    assert novedad_data["titulo"] == payload["titulo"]
    novedad_id = novedad_data["id"]

    # 2. Eliminar Novedad (Soft Delete)
    res_del = await client.delete(f"/api/v1/novedades/{novedad_id}")
    assert res_del.status_code == 204

@pytest.mark.asyncio
async def test_create_novedad_asunto_not_found(client):
    """
    [CASO BORDE / ERROR 404] Intentar publicar novedad en un asunto inexistente.
    """
    random_uuid = str(uuid.uuid4())
    payload = {
        "titulo": "Avance fantasma",
        "descripcion": "No debe guardarse",
        "publicado_al_cliente": True
    }
    response = await client.post(f"/api/v1/novedades/asunto/{random_uuid}", json=payload)
    assert response.status_code == 404
    assert response.json()["detail"] == "Asunto no encontrado"

@pytest.mark.asyncio
async def test_delete_novedad_not_found(client):
    """
    [CASO BORDE / ERROR 404] Intentar eliminar una novedad que no existe.
    """
    random_uuid = str(uuid.uuid4())
    response = await client.delete(f"/api/v1/novedades/{random_uuid}")
    assert response.status_code == 404
