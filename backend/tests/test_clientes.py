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
    carlos = next(
        item for item in data if item["nombre"] == "Carlos Gómez Restrepo"
    )
    assert carlos["asuntos_count"] >= 1

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
    assert data["numero_documento"] == payload["cedula"]
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


@pytest.mark.asyncio
async def test_lawyer_keeps_access_to_a_client_created_before_opening_a_case(
    alejandro_client,
):
    suffix = uuid.uuid4().hex[:8]
    created = await alejandro_client.post(
        "/api/v1/clientes",
        json={
            "nombre": f"Cliente nuevo {suffix}",
            "cedula": f"1099{suffix[:6]}",
            "email": f"cliente_{suffix}@example.com",
        },
    )
    assert created.status_code == 201

    listed = await alejandro_client.get("/api/v1/clientes")
    assert created.json()["id"] in {cliente["id"] for cliente in listed.json()}


@pytest.mark.asyncio
async def test_create_cliente_with_complete_directory_profile(client):
    suffix = uuid.uuid4().hex[:8]
    payload = {
        "tipo_persona": "natural",
        "tipo_documento": "CC",
        "numero_documento": f"63.{suffix[:3]}.{suffix[3:6]}",
        "nombre": f"María del Pilar {suffix}",
        "email": f"maria.{suffix}@example.com",
        "telefono": "315 555 0182",
        "fecha_expedicion": "2010-04-12",
        "direccion": "Carrera 27 # 48-16",
        "direccion_notificacion": "Calle 36 # 18-24 oficina 301",
        "ciudad": "Bucaramanga",
        "departamento": "Santander",
        "canal_preferido": "whatsapp",
        "observaciones": "Prefiere contacto después de las 2 p. m.",
    }

    response = await client.post("/api/v1/clientes", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["numero_documento"] == payload["numero_documento"]
    assert data["direccion"] == payload["direccion"]
    assert data["direccion_notificacion"] == payload["direccion_notificacion"]
    assert data["canal_preferido"] == "whatsapp"
    assert data["portal_user_id"] is None


@pytest.mark.asyncio
async def test_duplicate_client_document_is_rejected(client):
    response = await client.post(
        "/api/v1/clientes",
        json={
            "nombre": "Carlos duplicado",
            "numero_documento": "1094852140",
            "email": "duplicado@example.com",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Ya existe un cliente con esa identificación"
    )


@pytest.mark.asyncio
async def test_client_remains_in_directory_after_case_is_archived(client):
    suffix = uuid.uuid4().hex[:8]
    created_client = await client.post(
        "/api/v1/clientes",
        json={
            "nombre": f"Cliente permanente {suffix}",
            "numero_documento": f"77{suffix[:6]}",
            "email": f"permanente.{suffix}@example.com",
        },
    )
    assert created_client.status_code == 201
    client_id = created_client.json()["id"]

    created_case = await client.post(
        "/api/v1/asuntos",
        json={"cliente_id": client_id},
    )
    assert created_case.status_code == 201
    archived = await client.delete(
        f"/api/v1/asuntos/{created_case.json()['id']}"
    )
    assert archived.status_code == 204

    listed = await client.get("/api/v1/clientes")
    persisted = next(
        item for item in listed.json() if item["id"] == client_id
    )
    assert persisted["asuntos_count"] == 0
