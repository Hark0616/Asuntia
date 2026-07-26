import pytest

@pytest.mark.asyncio
async def test_list_estados(client):
    """
    Prueba listar el catálogo completo de los 10 estados procesales.
    """
    response = await client.get("/api/v1/estados")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["nombre"] == "Sin acción aún"
