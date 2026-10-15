import pytest
from datetime import timedelta

from httpx import ASGITransport, AsyncClient

from app.core.security import create_access_token, decode_access_token
from app.main import app

@pytest.mark.asyncio
async def test_request_otp_success(client):
    """
    Casos exitosos de solicitud de OTP con diferentes formatos de cédula.
    """
    # Formato con puntos
    res1 = await client.post("/api/v1/auth/otp/request", json={"cedula": "1.094.852.140", "firma_slug": "demo"})
    assert res1.status_code == 200

    # Formato numérico directo
    res2 = await client.post("/api/v1/auth/otp/request", json={"cedula": "1094852140", "firma_slug": "demo"})
    assert res2.status_code == 200

@pytest.mark.asyncio
async def test_verify_otp_success(client):
    """
    Prueba verificación exitosa con el código temporal local (12345).
    """
    await client.post(
        "/api/v1/auth/otp/request",
        json={"cedula": "1.094.852.140", "firma_slug": "demo"},
    )
    res = await client.post(
        "/api/v1/auth/otp/verify",
        json={
            "cedula": "1.094.852.140",
            "code": "12345",
            "firma_slug": "demo",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" not in data
    assert res.cookies.get("access_token")
    assert data["user"]["rol"] == "cliente"


@pytest.mark.asyncio
async def test_otp_cannot_be_reused(anonymous_client):
    await anonymous_client.post(
        "/api/v1/auth/otp/request",
        json={"cedula": "1.094.852.140", "firma_slug": "demo"},
    )
    payload = {
        "cedula": "1.094.852.140",
        "code": "12345",
        "firma_slug": "demo",
    }
    first = await anonymous_client.post("/api/v1/auth/otp/verify", json=payload)
    second = await anonymous_client.post("/api/v1/auth/otp/verify", json=payload)

    assert first.status_code == 200
    assert second.status_code == 401

@pytest.mark.asyncio
async def test_verify_otp_invalid_code(client):
    """
    [CASO BORDE / ERROR] Intento de ingresar un código OTP incorrecto.
    """
    await client.post(
        "/api/v1/auth/otp/request",
        json={"cedula": "1.094.852.140", "firma_slug": "demo"},
    )
    res = await client.post(
        "/api/v1/auth/otp/verify",
        json={"cedula": "1.094.852.140", "code": "000000", "firma_slug": "demo"}
    )
    assert res.status_code == 401
    assert "detail" in res.json()


@pytest.mark.asyncio
async def test_office_login_rejects_invalid_password(anonymous_client):
    res = await anonymous_client.post(
        "/api/v1/auth/login",
        json={
            "firma_slug": "demo",
            "email": "daniela.torres@asuntia.com",
            "password": "incorrecta",
        },
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_office_login_rejects_unknown_firm(anonymous_client):
    res = await anonymous_client.post(
        "/api/v1/auth/login",
        json={
            "firma_slug": "firma-inexistente",
            "email": "daniela.torres@asuntia.com",
            "password": "admin123",
        },
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_me_and_logout(client):
    me = await client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["rol"] == "administrador"

    logout = await client.post("/api/v1/auth/logout")
    assert logout.status_code == 204
    after_logout = await client.get("/api/v1/auth/me")
    assert after_logout.status_code == 401


async def test_logout_revokes_replayed_cookie_and_other_sessions(client):
    original_cookie = client.cookies.get("access_token")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as other:
        assert (await other.post("/api/v1/auth/login", json={"firma_slug": "demo",
            "email": "daniela.torres@asuntia.com", "password": "admin123"})).status_code == 200
        assert (await other.get("/api/v1/auth/me")).status_code == 200
        assert (await client.post("/api/v1/auth/logout")).status_code == 204
        assert (await other.get("/api/v1/auth/me")).status_code == 401
        assert (await client.get("/api/v1/auth/me", headers={"Cookie": f"access_token={original_cookie}"})).status_code == 401


async def test_expired_missing_revision_and_invalid_tokens(client, anonymous_client):
    claims = decode_access_token(client.cookies.get("access_token"))
    expired = create_access_token(claims, expires_delta=timedelta(seconds=-1))
    without_revision = create_access_token({key: value for key, value in claims.items() if key != "user_revision"})
    for token in (expired, without_revision, "invalid.jwt.cookie"):
        headers = {"Cookie": f"access_token={token}"}
        assert (await anonymous_client.get("/api/v1/auth/me", headers=headers)).status_code == 401
        # Salir es idempotente incluso si la cookie ya no autoriza acciones.
        response = await anonymous_client.post("/api/v1/auth/logout", headers=headers)
        assert response.status_code == 204
        assert "Max-Age=0" in response.headers["set-cookie"]
    assert (await client.get("/api/v1/auth/me")).status_code == 200
    assert (await anonymous_client.post("/api/v1/auth/logout")).status_code == 204

@pytest.mark.asyncio
async def test_verify_otp_malformed_code(client):
    """
    [CASO BORDE / ERROR] Código con letras o espacios.
    """
    res = await client.post(
        "/api/v1/auth/otp/verify",
        json={"cedula": "1.094.852.140", "code": "abc", "firma_slug": "demo"}
    )
    assert res.status_code == 401

@pytest.mark.asyncio
async def test_verify_otp_unregistered_cedula(client):
    """
    [CASO BORDE / ERROR] Intentar verificar OTP para una cédula no registrada en la sesión.
    """
    res = await client.post(
        "/api/v1/auth/otp/verify",
        json={"cedula": "999.999.999", "code": "999999", "firma_slug": "demo"}
    )
    assert res.status_code == 401
