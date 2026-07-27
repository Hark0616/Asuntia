import pytest

@pytest.mark.asyncio
async def test_get_storage_config_default(client):
    """
    Prueba obtener la configuración de almacenamiento por defecto.
    """
    response = await client.get("/api/v1/firma/storage/config")
    assert response.status_code == 200
    data = response.json()
    assert "provider" in data
    assert "auth_type" in data

@pytest.mark.asyncio
async def test_update_storage_config_local(client):
    """
    Prueba actualizar la configuración de almacenamiento a 'local'.
    """
    payload = {
        "provider": "local",
        "auth_type": "local",
        "root_folder_name": "Asuntia_Archivos_Locales",
        "is_active": True
    }
    response = await client.post("/api/v1/firma/storage/config", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["provider"] == "local"
    assert data["auth_type"] == "local"

@pytest.mark.asyncio
async def test_test_storage_connection(client):
    """
    Prueba ejecutar la verificación de conexión en vivo con el proveedor activo.
    """
    response = await client.post("/api/v1/firma/storage/config/test")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "folder_id" in data

@pytest.mark.asyncio
async def test_get_oauth_url(client):
    """
    Prueba obtener las URLs OAuth2 para Google Drive y OneDrive.
    """
    res_gdrive = await client.get("/api/v1/storage/auth-url?provider=google_drive")
    assert res_gdrive.status_code == 200
    assert "accounts.google.com" in res_gdrive.json()["auth_url"]

    res_onedrive = await client.get("/api/v1/storage/auth-url?provider=onedrive")
    assert res_onedrive.status_code == 200
    assert "login.microsoftonline.com" in res_onedrive.json()["auth_url"]

@pytest.mark.asyncio
async def test_preview_documento_proxy(client):
    """
    Prueba el endpoint de previsualización proxy de PDFs.
    """
    asunto_id = "00000000-0000-0000-0000-000000000201"
    # Vincular documento primero
    link_res = await client.post(f"/api/v1/asuntos/{asunto_id}/documentos/vincular", json={
        "nombre_funcional": "Auto Admisorio para Proxy Test",
        "external_file_id": "test_proxy_id",
        "web_view_url": "https://drive.google.com/test"
    })
    doc_id = link_res.json()["id"]

    res_preview = await client.get(f"/api/v1/documentos/{doc_id}/preview")
    assert res_preview.status_code == 200
    assert res_preview.headers["content-type"] == "application/pdf"
