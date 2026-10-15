"""Ingreso con contexto explícito, sin depender de la firma de demostración."""
import uuid

import pytest
import pytest_asyncio

from app.core.security import get_password_hash
from app.models.cliente import Cliente
from app.models.firma import Firma
from app.models.user import User


PASSWORD = 'test-firma-password'


@pytest_asyncio.fixture
async def firmas(db_session):
    token = uuid.uuid4().hex[:10]
    active = Firma(nombre='Firma de prueba activa', subdominio=f'firma-{token}')
    other = Firma(nombre='Otra firma de prueba', subdominio=f'otra-{token}')
    inactive = Firma(nombre='Firma de prueba inactiva', subdominio=f'inactiva-{token}', is_active=False)
    db_session.add_all([active, other, inactive])
    await db_session.flush()
    office = User(firma_id=active.id, nombre='Abogada de prueba', email=f'office-{token}@example.com',
        cedula=f'88{token}', rol='abogado', hashed_password=get_password_hash(PASSWORD))
    portal = User(firma_id=active.id, nombre='Cliente de prueba', email=f'portal-{token}@example.com',
        cedula=f'99{token}', rol='cliente')
    disabled_office = User(firma_id=inactive.id, nombre='Acceso deshabilitado', email=f'inactivo-{token}@example.com',
        cedula=f'77{token}', rol='abogado', hashed_password=get_password_hash(PASSWORD))
    db_session.add_all([office, portal, disabled_office])
    await db_session.flush()
    profile = Cliente(firma_id=active.id, nombre=portal.nombre, email=portal.email,
        numero_documento=portal.cedula, numero_documento_normalizado=portal.cedula.lower(), portal_user_id=portal.id)
    db_session.add(profile)
    await db_session.commit()
    yield active, other, inactive, office, portal, disabled_office
    for item in [active, other, inactive, office, portal, disabled_office, profile]:
        item.is_active = False
    await db_session.commit()


async def test_office_can_enter_active_firm_without_demo(firmas, anonymous_client):
    firm, _, _, user, _, _ = firmas
    response = await anonymous_client.post('/api/v1/auth/login', json={
        'firma_slug': f' {firm.subdominio.upper()} ', 'email': user.email, 'password': PASSWORD,
    })
    assert response.status_code == 200
    assert response.json()['user']['firma_id'] == str(firm.id)
    assert response.json()['user']['id'] == str(user.id)
    assert (await anonymous_client.get('/api/v1/auth/me')).json()['firma_id'] == str(firm.id)
    assert (await anonymous_client.get('/api/v1/asuntos/busqueda')).json()['total'] == 0


async def test_client_otp_uses_same_explicit_firm(firmas, anonymous_client):
    firm, other, _, _, portal, _ = firmas
    request = {'firma_slug': firm.subdominio, 'cedula': portal.cedula}
    assert (await anonymous_client.post('/api/v1/auth/otp/request', json=request)).status_code == 200
    wrong = await anonymous_client.post('/api/v1/auth/otp/verify', json={**request, 'firma_slug': other.subdominio, 'code': '12345'})
    assert wrong.status_code == 401
    accepted = await anonymous_client.post('/api/v1/auth/otp/verify', json={**request, 'code': '12345'})
    assert accepted.status_code == 200
    assert accepted.json()['user']['firma_id'] == str(firm.id)


async def test_deactivating_firm_invalidates_existing_session(firmas, anonymous_client, db_session):
    firm, _, _, user, _, _ = firmas
    accepted = await anonymous_client.post('/api/v1/auth/login', json={
        'firma_slug': firm.subdominio, 'email': user.email, 'password': PASSWORD,
    })
    assert accepted.status_code == 200
    firm.is_active = False
    await db_session.commit()
    assert (await anonymous_client.get('/api/v1/auth/me')).status_code == 401
    assert (await anonymous_client.get('/api/v1/asuntos/busqueda')).status_code == 401


async def test_unknown_inactive_and_other_firms_reject_office_credentials(firmas, anonymous_client):
    _, other, inactive, office, _, disabled = firmas
    for slug, email in [('inexistente', office.email), (other.subdominio, office.email), (inactive.subdominio, disabled.email)]:
        response = await anonymous_client.post('/api/v1/auth/login', json={
            'firma_slug': slug, 'email': email, 'password': PASSWORD,
        })
        assert response.status_code == 401
        assert not response.cookies.get('access_token')
    assert (await anonymous_client.get('/api/v1/auth/me')).status_code == 401


async def test_unknown_or_inactive_firm_otp_request_is_generic(firmas, anonymous_client):
    active, other, inactive, _, portal, _ = firmas
    bodies = []
    for slug in [active.subdominio, other.subdominio, inactive.subdominio, 'inexistente']:
        response = await anonymous_client.post('/api/v1/auth/otp/request', json={'firma_slug': slug, 'cedula': portal.cedula})
        assert response.status_code == 200
        bodies.append(response.json())
    assert all(body == bodies[0] for body in bodies)


@pytest.mark.parametrize('slug', [None, '', '  ', 'x' * 101])
@pytest.mark.parametrize('endpoint,payload', [
    ('login', {'email': 'office@example.com', 'password': PASSWORD}),
    ('otp/request', {'cedula': '123456'}),
    ('otp/verify', {'cedula': '123456', 'code': '12345'}),
])
async def test_firm_context_is_required_and_bounded(anonymous_client, slug, endpoint, payload):
    assert (await anonymous_client.post(f'/api/v1/auth/{endpoint}', json={**payload, 'firma_slug': slug})).status_code == 422
    assert (await anonymous_client.post(f'/api/v1/auth/{endpoint}', json=payload)).status_code == 422
