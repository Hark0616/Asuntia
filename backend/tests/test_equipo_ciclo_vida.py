"""Altas, acceso y transferencia atómica en firmas aisladas de los seeds."""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.security import get_password_hash
from app.main import app
from app.models.auth_challenge import AuthChallenge
from app.models.firma import Firma
from app.models.user import User

PASSWORD = "Prueba-equipo-2026!"


@pytest_asyncio.fixture
async def team(anonymous_client, db_session):
    slug = f"equipo-{uuid.uuid4().hex[:12]}"
    firma = Firma(nombre="Firma de prueba", subdominio=slug)
    db_session.add(firma)
    await db_session.flush()
    admin = User(firma_id=firma.id, nombre="Administración", email="admin@example.com",
                 cedula="ADMIN", rol="administrador", hashed_password=get_password_hash(PASSWORD))
    db_session.add(admin)
    await db_session.commit()
    response = await anonymous_client.post("/api/v1/auth/login", json={
        "firma_slug": slug, "email": admin.email, "password": PASSWORD})
    assert response.status_code == 200, response.text
    return dict(api=anonymous_client, slug=slug, admin=str(admin.id), firma_id=firma.id)


async def invite(team, *, rol="abogado", name=None):
    name = name or uuid.uuid4().hex[:10]
    response = await team["api"].post("/api/v1/equipo/invitaciones", json={
        "nombre": f"Miembro {name}", "email": f"{name}@example.com", "cedula": name, "rol": rol})
    assert response.status_code == 201, response.text
    assert response.headers["cache-control"] == "no-store"
    return response.json()


def activation(invitation, **changes):
    return dict(firma_slug=invitation["firma_slug"], invitacion_id=invitation["invitacion_id"],
                token=invitation["token"], password=PASSWORD, **changes)


async def activate(team, invitation):
    response = await team["api"].post("/api/v1/auth/equipo/activar", json=activation(invitation))
    assert response.status_code == 204, response.text
    return await member(team, invitation["miembro"]["id"])


async def member(team, user_id):
    response = await team["api"].get("/api/v1/equipo/gestion")
    assert response.status_code == 200, response.text
    return next(item for item in response.json() if item["id"] == user_id)


async def test_invitation_activation_login_and_one_use(team, db_session):
    invitation = await invite(team)
    assert invitation["miembro"]["estado"] == "invitado"
    stored = await db_session.get(AuthChallenge, uuid.UUID(invitation["invitacion_id"]))
    assert invitation["token"] != stored.code_hash
    assert stored.created_by_id == uuid.UUID(team["admin"])
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as api:
        login = dict(firma_slug=team["slug"], email=invitation["miembro"]["email"], password=PASSWORD)
        assert (await api.post("/api/v1/auth/login", json=login)).status_code == 401
        active = await activate(team, invitation)
        assert active["estado"] == "activo"
        assert (await api.post("/api/v1/auth/login", json=login)).status_code == 200
        assert (await api.get("/api/v1/equipo/gestion")).status_code == 403
        assert (await api.post("/api/v1/auth/equipo/activar", json=activation(invitation))).status_code == 400
    assert (await team["api"].get("/api/v1/auth/me")).json()["id"] == team["admin"]


async def test_resend_cancel_expiry_wrong_tenant_and_token(team, db_session):
    invitation = await invite(team)
    api = team["api"]
    body = activation(invitation)
    for change in ({"token": "x" * 43}, {"firma_slug": "demo"}, {"firma_slug": "no-existe"}):
        assert (await api.post("/api/v1/auth/equipo/activar", json={**body, **change})).status_code == 400
    response = await api.post(f"/api/v1/equipo/{invitation['miembro']['id']}/invitacion",
                             json={"expected_updated_at": invitation["miembro"]["updated_at"]})
    assert response.status_code == 200, response.text
    renewed = response.json()
    assert (await api.post("/api/v1/auth/equipo/activar", json=body)).status_code == 400
    stored = await db_session.get(AuthChallenge, uuid.UUID(renewed["invitacion_id"]))
    stored.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    await db_session.commit()
    assert (await api.post("/api/v1/auth/equipo/activar", json=activation(renewed))).status_code == 400
    current = await member(team, invitation["miembro"]["id"])
    assert current["estado"] == "inactivo"


async def test_cancel_pending_invitation(team):
    invitation = await invite(team)
    user = invitation["miembro"]
    response = await team["api"].post(f"/api/v1/equipo/{user['id']}/desactivar",
                                     json={"expected_updated_at": user["updated_at"]})
    assert response.status_code == 200, response.text
    assert response.json()["estado"] == "inactivo"
    assert (await team["api"].post("/api/v1/auth/equipo/activar", json=activation(invitation))).status_code == 400


async def test_duplicate_identity_and_concurrent_invites(team):
    payload = dict(nombre="Duplicado", email="duplicado@example.com", cedula="11.222", rol="auxiliar")
    results = await asyncio.gather(*[team["api"].post("/api/v1/equipo/invitaciones", json=payload) for _ in range(2)])
    assert sorted(response.status_code for response in results) == [201, 409]
    for change in ({"email": "otro@example.com", "cedula": "11222"},
                   {"email": "DUPLICADO@example.com", "cedula": "nuevodoc"}):
        assert (await team["api"].post("/api/v1/equipo/invitaciones", json={**payload, **change})).status_code == 409


@pytest.mark.parametrize("invalid", [{"nombre": " "}, {"cedula": "..."}, {"email": "bad"},
                                     {"rol": "cliente"}, {"rol": None}, {"is_active": True}])
async def test_invalid_invitation(team, invalid):
    response = await team["api"].post("/api/v1/equipo/invitaciones", json={
        "nombre": "Prueba", "cedula": "123", "email": "valid@example.com", "rol": "abogado", **invalid})
    assert response.status_code == 422


async def test_last_admin_self_change_stale_version_and_foreign_ids(team):
    api = team["api"]
    admin = await member(team, team["admin"])
    for path, payload in (("rol", {"rol": "abogado"}), ("desactivar", {})):
        method = api.patch if path == "rol" else api.post
        response = await method(f"/api/v1/equipo/{admin['id']}/{path}",
                                json={"expected_updated_at": admin["updated_at"], **payload})
        assert response.status_code == 409
    assert (await api.post("/api/v1/equipo/00000000-0000-0000-0000-000000000010/desactivar",
                          json={"expected_updated_at": admin["updated_at"]})).status_code == 404
    user = await activate(team, await invite(team))
    changed = await api.patch(f"/api/v1/equipo/{user['id']}/rol", json={
        "rol": "auxiliar", "expected_updated_at": user["updated_at"]})
    assert changed.status_code == 200, changed.text
    assert (await api.patch(f"/api/v1/equipo/{user['id']}/rol", json={
        "rol": "administrador", "expected_updated_at": user["updated_at"]})).status_code == 409


async def test_role_and_reactivation_never_restore_old_sessions(team):
    api = team["api"]
    invitation = await invite(team)
    user = await activate(team, invitation)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as worker:
        login = dict(firma_slug=team["slug"], email=user["email"], password=PASSWORD)
        assert (await worker.post("/api/v1/auth/login", json=login)).status_code == 200
        old_cookie = worker.cookies.get("access_token")
        changed = await api.patch(f"/api/v1/equipo/{user['id']}/rol", json={
            "rol": "auxiliar", "expected_updated_at": user["updated_at"]})
        assert changed.status_code == 200
        assert (await worker.get("/api/v1/auth/me")).status_code == 401
        changed_back = await api.patch(f"/api/v1/equipo/{user['id']}/rol", json={
            "rol": "abogado", "expected_updated_at": changed.json()["updated_at"]})
        assert changed_back.status_code == 200
        assert (await worker.get("/api/v1/auth/me")).status_code == 401
        revoked = await api.post(f"/api/v1/equipo/{user['id']}/desactivar",
            json={"expected_updated_at": changed_back.json()["updated_at"]})
        assert revoked.status_code == 200
        renewed = await api.post(f"/api/v1/equipo/{user['id']}/invitacion",
            json={"expected_updated_at": revoked.json()["updated_at"]})
        assert renewed.status_code == 200
        active = await activate(team, renewed.json())
        assert active["id"] == user["id"]
        assert worker.cookies.get("access_token") == old_cookie
        assert (await worker.get("/api/v1/auth/me")).status_code == 401
        assert (await worker.post("/api/v1/auth/login", json=login)).status_code == 200


async def test_atomic_offboarding_preserves_history_and_delegations(team, db_session):
    api = team["api"]
    worker = await activate(team, await invite(team))
    assistant = await activate(team, await invite(team, rol="auxiliar"))
    client_response = await api.post("/api/v1/clientes", json={"nombre": "Cliente", "numero_documento": "123",
        "email": "cliente@example.com", "habilitar_portal": False})
    assert client_response.status_code == 201, client_response.text
    client = client_response.json()
    assigned = await api.patch(f"/api/v1/clientes/{client['id']}/responsable", json={"responsable_id": worker["id"]})
    assert assigned.status_code == 200, assigned.text
    case = (await api.post("/api/v1/asuntos", json={"titulo": "Trabajo a transferir", "cliente_id": client["id"],
        "abogado_id": worker["id"], "ruta_codigo": "insolvencia_persona_natural:v2"})).json()
    task_ids = []
    for assignee in (worker, assistant, worker):
        task = await api.post("/api/v1/tareas", json={"asunto_id": case["id"], "titulo": "Revisar",
            "instruccion": "Revisar documentos", "responsable_id": assignee["id"]})
        assert task.status_code == 201, task.text
        task_ids.append(task.json()["id"])
    completed = task.json()
    assert (await api.patch(f"/api/v1/tareas/{completed['id']}", json={
        "estado": "completada", "expected_updated_at": completed["updated_at"]})).status_code == 200
    current = await member(team, worker["id"])
    body = {"expected_updated_at": current["updated_at"]}
    for extra, status in (({}, 409), ({"reasignar_a_id": assistant["id"]}, 404),
                          ({"reasignar_a_id": "00000000-0000-0000-0000-000000000010"}, 404)):
        assert (await api.post(f"/api/v1/equipo/{worker['id']}/desactivar", json={**body, **extra})).status_code == status
        unchanged = await api.get(f"/api/v1/asuntos/id/{case['id']}")
        assert unchanged.json()["abogado_id"] == worker["id"]
    response = await api.post(f"/api/v1/equipo/{worker['id']}/desactivar",
        json={**body, "reasignar_a_id": team["admin"]})
    assert response.status_code == 200, response.text
    assert response.json()["estado"] == "inactivo"
    from app.models.asunto import Asunto
    from app.models.cliente import Cliente
    from app.models.tarea import Tarea
    case_db = await db_session.get(Asunto, uuid.UUID(case["id"]))
    assert str(case_db.abogado_id) == team["admin"]
    assert case_db.created_by_id == uuid.UUID(team["admin"])
    assert (await db_session.get(Cliente, uuid.UUID(client["id"]))).responsable_id == uuid.UUID(team["admin"])
    tasks = list((await db_session.scalars(select(Tarea).where(Tarea.asunto_id == case_db.id))).all())
    by_id = {str(task.id): str(task.responsable_id) for task in tasks}
    assert by_id[task_ids[0]] == team["admin"]
    assert by_id[task_ids[1]] == assistant["id"]
    assert by_id[task_ids[2]] == worker["id"]
    assert next(task for task in tasks if task.tipo == "completar_paso").responsable_id == uuid.UUID(team["admin"])


async def test_management_authentication(anonymous_client, carlos_client, alejandro_client, sandra_client):
    assert (await anonymous_client.get("/api/v1/equipo/gestion")).status_code == 401
    for api in (carlos_client, alejandro_client, sandra_client):
        assert (await api.get("/api/v1/equipo/gestion")).status_code == 403
        assert (await api.post("/api/v1/equipo/invitaciones", json={
            "nombre": "No permitido", "email": "no@example.com", "cedula": "123", "rol": "administrador"})).status_code == 403


async def test_activation_concurrency_and_password_validation(team):
    invitation = await invite(team)
    body = activation(invitation)
    assert (await team["api"].post("/api/v1/auth/equipo/activar", json={**body, "password": "corta"})).status_code == 422
    results = await asyncio.gather(*[team["api"].post("/api/v1/auth/equipo/activar", json=body) for _ in range(2)])
    assert sorted(response.status_code for response in results) == [204, 400]


async def test_concurrent_administrators_cannot_remove_all_control(team):
    invitation = await invite(team, rol="administrador")
    other = await activate(team, invitation)
    original = await member(team, team["admin"])
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as api:
        assert (await api.post("/api/v1/auth/login", json={"firma_slug": team["slug"],
            "email": other["email"], "password": PASSWORD})).status_code == 200
        results = await asyncio.gather(
            team["api"].post(f"/api/v1/equipo/{other['id']}/desactivar",
                json={"expected_updated_at": other["updated_at"]}),
            api.post(f"/api/v1/equipo/{original['id']}/desactivar",
                json={"expected_updated_at": original["updated_at"]}),
        )
        assert sum(response.status_code == 200 for response in results) == 1
        assert all(response.status_code in {200, 401, 409} for response in results)
        survivor = team["api"] if results[0].status_code == 200 else api
        members = (await survivor.get("/api/v1/equipo/gestion")).json()
        assert len([user for user in members if user["rol"] == "administrador" and user["estado"] == "activo"]) == 1


async def test_role_demotion_transfers_inaccessible_work_and_keeps_ownership(team):
    api = team["api"]
    outgoing = await activate(team, await invite(team, rol="auxiliar"))
    destination = await activate(team, await invite(team))
    client = await api.post("/api/v1/clientes", json={"nombre": "Cliente", "numero_documento": "456",
        "email": "cliente@example.com", "habilitar_portal": False})
    assert client.status_code == 201, client.text
    case = await api.post("/api/v1/asuntos", json={"titulo": "Asunto ajeno", "cliente_id": client.json()["id"]})
    assert case.status_code == 201, case.text
    task = await api.post("/api/v1/tareas", json={"asunto_id": case.json()["id"], "titulo": "Preparar",
        "instruccion": "Preparar anexos", "responsable_id": outgoing["id"]})
    assert task.status_code == 201, task.text
    change = dict(rol="abogado", expected_updated_at=outgoing["updated_at"])
    path = f"/api/v1/equipo/{outgoing['id']}/rol"
    assert (await api.patch(path, json=change)).status_code == 409
    assert (await api.patch(path, json={**change, "reasignar_a_id": destination["id"]})).status_code == 409
    result = await api.patch(path, json={**change, "reasignar_a_id": team["admin"]})
    assert result.status_code == 200, result.text
    tasks = await api.get(f"/api/v1/tareas/asunto/{case.json()['id']}")
    assert tasks.status_code == 200, tasks.text
    assert next(item for item in tasks.json() if item["id"] == task.json()["id"])["responsable"]["id"] == team["admin"]


async def test_assignment_and_offboarding_are_serialized(team):
    api = team["api"]
    outgoing = await activate(team, await invite(team))
    client = await api.post("/api/v1/clientes", json={"nombre": "Cliente", "numero_documento": "789",
        "email": "cliente@example.com", "habilitar_portal": False})
    assert client.status_code == 201
    results = await asyncio.gather(
        api.post("/api/v1/asuntos", json={"titulo": "Apertura simultánea", "cliente_id": client.json()["id"],
            "abogado_id": outgoing["id"], "ruta_codigo": "insolvencia_persona_natural:v2"}),
        api.post(f"/api/v1/equipo/{outgoing['id']}/desactivar", json={
            "expected_updated_at": outgoing["updated_at"], "reasignar_a_id": team["admin"]}),
    )
    assert results[1].status_code == 200, results[1].text
    assert results[0].status_code in {201, 404}, results[0].text
    if results[0].status_code == 201:
        case = await api.get(f"/api/v1/asuntos/id/{results[0].json()['id']}")
        assert case.json()["abogado_id"] == team["admin"]


async def test_offboarding_failure_rolls_back_transferred_work(team, monkeypatch, db_session):
    from app.models.asunto import Asunto
    from sqlalchemy.ext.asyncio import AsyncSession

    api = team["api"]
    outgoing = await activate(team, await invite(team))
    client = await api.post("/api/v1/clientes", json={"nombre": "Cliente", "numero_documento": "987",
        "email": "cliente@example.com", "habilitar_portal": False})
    assert client.status_code == 201
    case = await api.post("/api/v1/asuntos", json={"titulo": "Conservación ante fallo", "cliente_id": client.json()["id"],
        "abogado_id": outgoing["id"]})
    assert case.status_code == 201
    async def fail_offboarding(session):
        raise RuntimeError("fallo de persistencia simulado")

    monkeypatch.setattr(AsyncSession, "commit", fail_offboarding)
    with pytest.raises(RuntimeError, match="fallo de persistencia"):
        await api.post(f"/api/v1/equipo/{outgoing['id']}/desactivar", json={
            "expected_updated_at": outgoing["updated_at"], "reasignar_a_id": team["admin"]})
    user_db = await db_session.get(User, uuid.UUID(outgoing["id"]))
    case_db = await db_session.get(Asunto, uuid.UUID(case.json()["id"]))
    assert user_db.is_active
    assert str(case_db.abogado_id) == outgoing["id"]
