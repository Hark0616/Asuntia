import pytest

@pytest.mark.asyncio
async def test_request_otp_success(client):
    """
    Casos exitosos de solicitud de OTP con diferentes formatos de cédula.
    """
    # Formato con puntos
    res1 = await client.post("/api/v1/auth/otp/request", json={"cedula": "1.094.852.140"})
    assert res1.status_code == 200

    # Formato numérico directo
    res2 = await client.post("/api/v1/auth/otp/request", json={"cedula": "1094852140"})
    assert res2.status_code == 200

@pytest.mark.asyncio
async def test_verify_otp_success(client):
    """
    Prueba verificación exitosa con el código OTP dev (123456).
    """
    res = await client.post(
        "/api/v1/auth/otp/verify",
        json={"cedula": "1.094.852.140", "code": "123456"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["rol"] == "cliente"

@pytest.mark.asyncio
async def test_verify_otp_invalid_code(client):
    """
    [CASO BORDE / ERROR] Intento de ingresar un código OTP incorrecto.
    """
    res = await client.post(
        "/api/v1/auth/otp/verify",
        json={"cedula": "1.094.852.140", "code": "000000"}
    )
    assert res.status_code == 401
    assert "detail" in res.json()

@pytest.mark.asyncio
async def test_verify_otp_malformed_code(client):
    """
    [CASO BORDE / ERROR] Código con letras o espacios.
    """
    res = await client.post(
        "/api/v1/auth/otp/verify",
        json={"cedula": "1.094.852.140", "code": "abc"}
    )
    assert res.status_code == 401

@pytest.mark.asyncio
async def test_verify_otp_unregistered_cedula(client):
    """
    [CASO BORDE / ERROR] Intentar verificar OTP para una cédula no registrada en la sesión.
    """
    res = await client.post(
        "/api/v1/auth/otp/verify",
        json={"cedula": "999.999.999", "code": "999999"}
    )
    assert res.status_code == 401
