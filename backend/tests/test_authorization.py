import pytest


@pytest.mark.asyncio
async def test_protected_endpoints_require_session(anonymous_client):
    assert (await anonymous_client.get("/api/v1/asuntos")).status_code == 401
    assert (await anonymous_client.get("/api/v1/clientes")).status_code == 401
    assert (await anonymous_client.get("/api/v1/estados")).status_code == 401


@pytest.mark.asyncio
async def test_client_only_lists_own_asuntos(elena_client):
    response = await elena_client.get("/api/v1/asuntos")
    assert response.status_code == 200
    asuntos = response.json()
    assert [asunto["radicado"] for asunto in asuntos] == ["AS-2026-003"]


@pytest.mark.asyncio
async def test_client_cannot_open_another_clients_asunto(elena_client):
    response = await elena_client.get("/api/v1/asuntos/AS-2026-001")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_client_cannot_list_customers_or_mutate_asunto(elena_client):
    assert (await elena_client.get("/api/v1/clientes")).status_code == 403
    response = await elena_client.patch(
        "/api/v1/asuntos/00000000-0000-0000-0000-000000000203/estado",
        json={"siguiente_paso": "Cambio no autorizado"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_client_only_receives_public_novedades(carlos_client):
    response = await carlos_client.get("/api/v1/asuntos")
    assert response.status_code == 200
    asuntos = response.json()
    assert len(asuntos) == 1
    assert all(
        novedad["publicado_al_cliente"]
        for novedad in asuntos[0]["novedades"]
    )


@pytest.mark.asyncio
async def test_client_cannot_access_private_document(carlos_client):
    response = await carlos_client.get(
        "/api/v1/documentos/00000000-0000-0000-0000-000000000403/preview"
    )
    assert response.status_code == 404
