import pytest
import uuid

@pytest.mark.asyncio
async def test_list_clientes_success(client):
    """
    Prueba listar los clientes activos de la firma.
    """
    response = await client.get("/api/v1/clientes")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

@pytest.mark.asyncio
async def test_create_cliente_success(client):
    """
    Prueba registrar un nuevo cliente con datos válidos.
    """
    payload = {
        "nombre": f"Empresa Test {uuid.uuid4().hex[:4]} S.A.S.",
        "cedula": f"901.{uuid.uuid4().hex[:3]}.456-7",
        "email": f"contacto_{uuid.uuid4().hex[:4]}@ejemplo.co"
    }
    response = await client.post("/api/v1/clientes", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["nombre"] == payload["nombre"]
    assert data["cedula"] == payload["cedula"]
    assert data["rol"] == "cliente"

@pytest.mark.asyncio
async def test_create_cliente_missing_fields(client):
    """
    [CASO BORDE / ERROR 422] Crear cliente sin enviar la cédula obligatoria.
    """
    payload = {
        "nombre": "Incompleto S.A.S.",
        "email": "incompleto@ejemplo.co"
    }
    response = await client.post("/api/v1/clientes", json=payload)
    assert response.status_code == 422 # Pydantic Validation Error
