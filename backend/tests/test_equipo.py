import pytest


@pytest.mark.asyncio
async def test_office_lists_case_responsibles(client):
    response = await client.get("/api/v1/equipo/responsables")

    assert response.status_code == 200
    assert {
        (item["nombre"], item["rol"]) for item in response.json()
    } == {
        ("Dr. Alejandro Morales", "abogado"),
        ("Dra. Daniela Torres", "administrador"),
    }


@pytest.mark.asyncio
async def test_client_cannot_list_case_responsibles(carlos_client):
    response = await carlos_client.get("/api/v1/equipo/responsables")

    assert response.status_code == 403
