"""Límites persistentes, OTP atómico y recuperación sin revelar cuentas."""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlsplit

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.api.v1.endpoints import auth as endpoints
from app.config import settings
from app.core.security import get_password_hash, verify_password
from app.models.auth_challenge import AuthChallenge
from app.models.auth_rate_limit import AuthRateLimit
from app.models.cliente import Cliente
from app.models.firma import Firma
from app.models.user import User

PASSWORD = "Password-prueba-2026!"
NEW_PASSWORD = "Nueva-password-2026!"


@pytest_asyncio.fixture
async def auth_case(db_session, anonymous_client, monkeypatch):
    suffix = uuid.uuid4().hex[:10]
    firm = Firma(nombre="Firma de autenticación", subdominio=f"auth-{suffix}")
    other = Firma(nombre="Otra firma", subdominio=f"other-{suffix}")
    db_session.add_all([firm, other])
    await db_session.flush()
    office = User(firma_id=firm.id, nombre="Administradora", email="office@example.com", cedula="111",
        rol="administrador", hashed_password=get_password_hash(PASSWORD))
    portal = User(firma_id=firm.id, nombre="Cliente", email="portal@example.com", cedula="222", rol="cliente")
    db_session.add_all([office, portal])
    await db_session.flush()
    profile = Cliente(firma_id=firm.id, nombre=portal.nombre, email=portal.email, numero_documento="222",
        numero_documento_normalizado="222", portal_user_id=portal.id)
    db_session.add(profile)
    await db_session.commit()
    messages = []

    async def reset_mail(email, link):
        messages.append(("reset", email, link))

    async def otp_mail(email, code):
        messages.append(("otp", email, code))

    async def changed_mail(email):
        messages.append(("changed", email))

    monkeypatch.setattr(endpoints, "send_password_reset_email", reset_mail)
    monkeypatch.setattr(endpoints, "send_otp_email", otp_mail)
    monkeypatch.setattr(endpoints, "send_password_changed_email", changed_mail)
    return dict(api=anonymous_client, firm=firm, other=other, office=office, portal=portal, messages=messages)


def login(case, **changes):
    return dict(firma_slug=case["firm"].subdominio, email=case["office"].email, password=PASSWORD, **changes)


def otp(case):
    return dict(firma_slug=case["firm"].subdominio, cedula=case["portal"].cedula)


async def request_reset(case):
    response = await case["api"].post("/api/v1/auth/password/request", json={
        "firma_slug": case["firm"].subdominio, "email": case["office"].email})
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "no-store"
    link = next(message[2] for message in reversed(case["messages"]) if message[0] == "reset")
    fragment = parse_qs(urlsplit(link).fragment)
    return dict(firma_slug=case["firm"].subdominio, challenge_id=fragment["challenge"][0],
        token=fragment["token"][0], password=NEW_PASSWORD), response


async def test_otp_consumed_once_under_concurrent_verification(auth_case, db_session):
    api = auth_case["api"]
    responses = await asyncio.gather(*[api.post("/api/v1/auth/otp/request", json=otp(auth_case)) for _ in range(2)])
    assert all(response.status_code == 200 for response in responses)
    active = list((await db_session.scalars(select(AuthChallenge).where(
        AuthChallenge.user_id == auth_case["portal"].id, AuthChallenge.is_active.is_(True)))).all())
    assert len(active) == 1
    results = await asyncio.gather(*[api.post("/api/v1/auth/otp/verify", json={**otp(auth_case), "code": "12345"}) for _ in range(2)])
    assert sorted(result.status_code for result in results) == [200, 401]
    await db_session.refresh(active[0])
    assert active[0].consumed_at is not None
    assert not active[0].is_active


async def test_concurrent_wrong_codes_exhaust_the_same_budget(auth_case, db_session):
    api = auth_case["api"]
    assert (await api.post("/api/v1/auth/otp/request", json=otp(auth_case))).status_code == 200
    results = await asyncio.gather(*[api.post("/api/v1/auth/otp/verify", json={**otp(auth_case), "code": "00000"}) for _ in range(7)])
    assert all(result.status_code == 401 for result in results)
    challenge = await db_session.scalar(select(AuthChallenge).where(AuthChallenge.user_id == auth_case["portal"].id))
    assert challenge.attempts == settings.OTP_MAX_ATTEMPTS
    assert not challenge.is_active
    assert (await api.post("/api/v1/auth/otp/verify", json={**otp(auth_case), "code": "12345"})).status_code == 401


async def test_expired_otp_cannot_issue_a_session(auth_case, db_session):
    api = auth_case["api"]
    await api.post("/api/v1/auth/otp/request", json=otp(auth_case))
    challenge = await db_session.scalar(select(AuthChallenge).where(AuthChallenge.user_id == auth_case["portal"].id))
    challenge.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    await db_session.commit()
    response = await api.post("/api/v1/auth/otp/verify", json={**otp(auth_case), "code": "12345"})
    assert response.status_code == 401
    assert "access_token" not in response.cookies


async def test_identity_login_limit_is_atomic_persistent_and_normalized(auth_case, monkeypatch, db_session):
    monkeypatch.setattr(settings, "AUTH_LOGIN_LIMIT", 3)
    api = auth_case["api"]
    body = {**login(auth_case), "password": "incorrecta"}
    responses = await asyncio.gather(*[api.post("/api/v1/auth/login", json=body) for _ in range(5)])
    assert sorted(response.status_code for response in responses) == [401, 401, 401, 429, 429]
    denied = await api.post("/api/v1/auth/login", json={**body, "email": body["email"].upper()},
        headers={"Origin": "http://127.0.0.1:5173"})
    assert denied.status_code == 429
    assert int(denied.headers["retry-after"]) > 0
    assert "Retry-After" in denied.headers["access-control-expose-headers"]
    rows = list((await db_session.scalars(select(AuthRateLimit).where(AuthRateLimit.firma_id == auth_case["firm"].id))).all())
    assert sorted(row.attempts for row in rows) == [3, 6]
    assert all("office" not in row.key_hash and len(row.key_hash) == 64 for row in rows)
    # La ventana vence en BD; no depende de reiniciar el proceso web.
    for row in rows:
        row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    await db_session.commit()
    assert (await api.post("/api/v1/auth/login", json=login(auth_case))).status_code == 200


async def test_ip_budget_cannot_be_bypassed_by_changing_account(auth_case, monkeypatch):
    monkeypatch.setattr(settings, "AUTH_IP_LIMIT", 2)
    api = auth_case["api"]
    for email in ("one@example.com", "two@example.com"):
        assert (await api.post("/api/v1/auth/login", json={**login(auth_case), "email": email})).status_code == 401
    result = await api.post("/api/v1/auth/login", json=login(auth_case), headers={"X-Forwarded-For": "203.0.113.9"})
    assert result.status_code == 429
    # El presupuesto de una firma no bloquea otra.
    other = await api.post("/api/v1/auth/login", json={**login(auth_case), "firma_slug": auth_case["other"].subdominio})
    assert other.status_code == 401


async def test_login_errors_and_recovery_do_not_reveal_accounts(auth_case):
    api = auth_case["api"]
    responses = [await api.post("/api/v1/auth/login", json=body) for body in (
        {**login(auth_case), "password": "incorrecta"},
        {**login(auth_case), "email": "absent@example.com"},
        {**login(auth_case), "firma_slug": "unknown"},
    )]
    assert all(response.status_code == 401 for response in responses)
    assert len({response.text for response in responses}) == 1
    known, response = await request_reset(auth_case)
    for body in ({"firma_slug": "unknown", "email": auth_case["office"].email},
                 {"firma_slug": auth_case["firm"].subdominio, "email": auth_case["portal"].email}):
        unknown = await api.post("/api/v1/auth/password/request", json=body)
        assert unknown.status_code == 200
        assert unknown.json() == response.json()
    assert len([message for message in auth_case["messages"] if message[0] == "reset"]) == 1


async def test_non_development_otp_is_random_six_digits_and_cannot_reset_password(auth_case, monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "staging")
    await auth_case["api"].post("/api/v1/auth/otp/request", json=otp(auth_case))
    code = auth_case["messages"][-1][2]
    assert len(code) == 6 and code.isdigit()
    assert (await auth_case["api"].post("/api/v1/auth/otp/verify", json={**otp(auth_case), "code": code})).status_code == 200


async def test_team_role_change_revokes_pending_password_reset(auth_case):
    api = auth_case["api"]
    body, _ = await request_reset(auth_case)
    assert (await api.post("/api/v1/auth/login", json=login(auth_case))).status_code == 200
    invitation = await api.post("/api/v1/equipo/invitaciones", json={"nombre": "Otro administrador",
        "email": "second@example.com", "cedula": "333", "rol": "administrador"})
    assert invitation.status_code == 201
    data = invitation.json()
    assert (await api.post("/api/v1/auth/equipo/activar", json={"firma_slug": data["firma_slug"],
        "invitacion_id": data["invitacion_id"], "token": data["token"], "password": PASSWORD})).status_code == 204
    assert (await api.post("/api/v1/auth/login", json={**login(auth_case), "email": "second@example.com"})).status_code == 200
    members = (await api.get("/api/v1/equipo/gestion")).json()
    original = next(member for member in members if member["id"] == str(auth_case["office"].id))
    changed = await api.patch(f"/api/v1/equipo/{original['id']}/rol", json={"rol": "auxiliar",
        "expected_updated_at": original["updated_at"]})
    assert changed.status_code == 200, changed.text
    assert (await api.post("/api/v1/auth/password/confirm", json=body)).status_code == 400


@pytest.mark.parametrize("path,setting,body_kind", [
    ("otp/request", "AUTH_OTP_REQUEST_LIMIT", "otp"),
    ("password/request", "AUTH_RECOVERY_REQUEST_LIMIT", "reset"),
])
async def test_request_limits_do_not_reveal_account_existence(auth_case, monkeypatch, path, setting, body_kind):
    monkeypatch.setattr(settings, setting, 1)
    api = auth_case["api"]
    known = otp(auth_case) if body_kind == "otp" else {"firma_slug": auth_case["firm"].subdominio, "email": auth_case["office"].email}
    unknown = {**known, **({"cedula": "999"} if body_kind == "otp" else {"email": "unknown@example.com"})}
    first = await api.post(f"/api/v1/auth/{path}", json=known)
    missing = await api.post(f"/api/v1/auth/{path}", json=unknown)
    assert first.status_code == missing.status_code == 200
    assert first.json() == missing.json()
    for body in (known, unknown):
        assert (await api.post(f"/api/v1/auth/{path}", json=body)).status_code == 429


async def test_reset_consumes_link_changes_password_and_revokes_sessions(auth_case, db_session):
    api = auth_case["api"]
    assert (await api.post("/api/v1/auth/login", json=login(auth_case))).status_code == 200
    cookie = api.cookies.get("access_token")
    body, response = await request_reset(auth_case)
    assert response.json()["expires_in_seconds"] == settings.PASSWORD_RESET_TTL_MINUTES * 60
    assert body["token"] not in response.text
    assert auth_case["office"].email not in response.text
    stored = await db_session.get(AuthChallenge, uuid.UUID(body["challenge_id"]))
    assert stored.code_hash != body["token"]
    results = await asyncio.gather(*[api.post("/api/v1/auth/password/confirm", json=body) for _ in range(2)])
    assert sorted(result.status_code for result in results) == [204, 400]
    accepted = next(result for result in results if result.status_code == 204)
    assert "Max-Age=0" in accepted.headers["set-cookie"]
    assert (await api.get("/api/v1/auth/me", headers={"Cookie": f"access_token={cookie}"})).status_code == 401
    assert (await api.post("/api/v1/auth/login", json=login(auth_case))).status_code == 401
    assert (await api.post("/api/v1/auth/login", json={**login(auth_case), "password": NEW_PASSWORD})).status_code == 200
    assert ("changed", auth_case["office"].email) in auth_case["messages"]


async def test_reset_renewal_expiry_tenant_purpose_and_inactive_user(auth_case, db_session):
    api = auth_case["api"]
    old, _ = await request_reset(auth_case)
    current, _ = await request_reset(auth_case)
    for extra in ({"token": "x" * 43}, {"firma_slug": auth_case["other"].subdominio}, {"firma_slug": "unknown"}):
        assert (await api.post("/api/v1/auth/password/confirm", json={**current, **extra})).status_code == 400
    assert (await api.post("/api/v1/auth/password/confirm", json=old)).status_code == 400
    stored = await db_session.get(AuthChallenge, uuid.UUID(current["challenge_id"]))
    stored.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    await db_session.commit()
    assert (await api.post("/api/v1/auth/password/confirm", json=current)).status_code == 400
    active, _ = await request_reset(auth_case)
    auth_case["office"].is_active = False
    await db_session.commit()
    assert (await api.post("/api/v1/auth/password/confirm", json=active)).status_code == 400
    assert verify_password(PASSWORD, auth_case["office"].hashed_password)


@pytest.mark.parametrize("invalid", [{"password": None}, {"password": "short"}, {"password": " " * 12},
    {"password": "x" * 129}, {"token": "short"}, {"challenge_id": "bad"}, {"firma_slug": ""}, {"rol": "administrador"}])
async def test_reset_validation(auth_case, invalid):
    body, _ = await request_reset(auth_case)
    result = await auth_case["api"].post("/api/v1/auth/password/confirm", json={**body, **invalid})
    assert result.status_code == 422


async def test_reset_failure_rolls_back_password_and_link(auth_case, db_session, monkeypatch):
    import app.services.auth_service as service

    body, _ = await request_reset(auth_case)

    def fail_hash(password):
        raise RuntimeError("fallo simulado")

    monkeypatch.setattr(service, "get_password_hash", fail_hash)
    with pytest.raises(RuntimeError, match="fallo simulado"):
        await auth_case["api"].post("/api/v1/auth/password/confirm", json=body)
    stored = await db_session.get(AuthChallenge, uuid.UUID(body["challenge_id"]))
    await db_session.refresh(auth_case["office"])
    assert stored.is_active and stored.consumed_at is None
    assert verify_password(PASSWORD, auth_case["office"].hashed_password)
