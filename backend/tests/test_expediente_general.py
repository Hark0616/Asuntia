"""Apertura general, identidad, guía optativa y detalle independiente de listas."""
import asyncio
import uuid

import pytest
import pytest_asyncio
from sqlalchemy import func, select

from app.models.asunto import Asunto
from app.models.cliente import Cliente
from app.models.tarea import Tarea
from app.models.user import User
from app.repositories.asunto_repository import AsuntoRepository
import app.services.asunto_service as service_module


CARLOS = "00000000-0000-0000-0000-000000000020"
ALEJANDRO = "00000000-0000-0000-0000-000000000011"
GUIA = "insolvencia_persona_natural:v2"


@pytest_asyncio.fixture
async def case(client):
    response = await client.post('/api/v1/asuntos/apertura', json={
        'titulo': 'Revisión de contrato de arrendamiento', 'cliente_id': CARLOS,
    })
    assert response.status_code == 201, response.text
    body = response.json()
    yield body
    assert (await client.delete(f"/api/v1/asuntos/{body['id']}")).status_code in {204, 404}


async def test_general_case_has_no_insolvency_state_or_tasks(case, client, db_session):
    assert case['titulo'] == 'Revisión de contrato de arrendamiento'
    assert case['codigo_interno'] == case['radicado']
    assert case['codigo_interno'].startswith('AS-')
    assert case['radicado_oficial'] is None
    assert case['ruta_codigo'] is None
    assert case['paso_actual'] is None
    assert case['flujo_estado'] is None
    assert case['pasos'] == []
    assert case['estado'] is None
    assert case['etapa_actual'] == 'Sin guía'
    assert case['cliente']['id'] == CARLOS
    tasks = await db_session.scalar(select(func.count()).select_from(Tarea).where(Tarea.asunto_id == uuid.UUID(case['id'])))
    assert tasks == 0
    note = await client.post(f"/api/v1/novedades/asunto/{case['id']}", json={
        'titulo': 'Revisión', 'descripcion': 'Se recibió el contrato.',
    })
    assert note.status_code == 201
    detail = (await client.get(f"/api/v1/asuntos/id/{case['id']}")).json()
    assert any(item['id'] == note.json()['id'] for item in detail['novedades'])


async def test_attach_guide_once_preserves_identity_and_activity(case, client):
    note = await client.post(f"/api/v1/novedades/asunto/{case['id']}", json={'titulo': 'Recepción', 'descripcion': 'Conservar.'})
    path = f"/api/v1/asuntos/{case['id']}/guia"
    first, second = await asyncio.gather(*[client.post(path, json={'ruta_codigo': GUIA}) for _ in range(2)])
    assert sorted([first.status_code, second.status_code]) == [200, 409]
    detail = (await client.get(f"/api/v1/asuntos/id/{case['id']}")).json()
    assert detail['titulo'] == case['titulo']
    assert detail['codigo_interno'] == case['codigo_interno']
    assert len(detail['pasos']) == 7
    assert detail['paso_actual'] == 1
    assert sum(p['estado'] == 'activo' for p in detail['pasos']) == 1
    assert any(n['id'] == note.json()['id'] for n in detail['novedades'])
    work = (await client.get('/api/v1/tareas/mi-trabajo')).json()['items']
    assert sum(item['asunto']['id'] == case['id'] for item in work) == 1


@pytest.mark.parametrize('payload', [
    {}, {'titulo': None}, {'titulo': ''}, {'titulo': '   '}, {'titulo': 'x' * 256},
    {'titulo': 'Consulta', 'ruta_codigo': 'desconocida'},
    {'titulo': 'Consulta', 'radicado_oficial': '   '},
    {'titulo': 'Consulta', 'radicado_oficial': 'x' * 101},
    {'titulo': 'Consulta', 'codigo_interno': ''},
])
async def test_open_rejects_invalid_identity(client, payload):
    response = await client.post('/api/v1/asuntos', json={'cliente_id': CARLOS, **payload})
    assert response.status_code == 422


async def test_guide_and_detail_authorization(case, anonymous_client, carlos_client, elena_client, alejandro_client, sandra_client, client):
    detail = f"/api/v1/asuntos/id/{case['id']}"
    attach = f"/api/v1/asuntos/{case['id']}/guia"
    assert (await anonymous_client.get(detail)).status_code == 401
    assert (await anonymous_client.post(attach, json={'ruta_codigo': GUIA})).status_code == 401
    assert (await elena_client.get(detail)).status_code == 404
    assert (await alejandro_client.get(detail)).status_code == 404
    assert (await alejandro_client.post(attach, json={'ruta_codigo': GUIA})).status_code == 404
    assert (await sandra_client.get(detail)).status_code == 200
    assert (await sandra_client.post(attach, json={'ruta_codigo': GUIA})).status_code == 403
    assert (await carlos_client.post(attach, json={'ruta_codigo': GUIA})).status_code == 403
    public = await carlos_client.get(detail)
    assert public.status_code == 200
    assert 'pasos' not in public.json()
    assert 'cliente' not in public.json()
    assert 'siguiente_paso' not in public.json()
    assert (await client.post(attach, json={'ruta_codigo': 'inexistente'})).status_code == 422
    assert (await client.get('/api/v1/asuntos/id/no-es-uuid')).status_code == 422
    assert (await client.get(f'/api/v1/asuntos/id/{uuid.uuid4()}')).status_code == 404
    assert (await client.post(f'/api/v1/asuntos/{uuid.uuid4()}/guia', json={'ruta_codigo': GUIA})).status_code == 404


async def test_archive_keeps_code_reserved(case, client, db_session):
    assert (await client.delete(f"/api/v1/asuntos/{case['id']}")).status_code == 204
    assert (await client.get(f"/api/v1/asuntos/id/{case['id']}")).status_code == 404
    assert (await client.post(f"/api/v1/asuntos/{case['id']}/guia", json={'ruta_codigo': GUIA})).status_code == 404
    duplicate = await client.post('/api/v1/asuntos', json={
        'titulo': 'Otro asunto', 'cliente_id': CARLOS, 'codigo_interno': case['codigo_interno'],
    })
    assert duplicate.status_code == 409
    saved = await db_session.get(Asunto, uuid.UUID(case['id']))
    assert saved is not None and not saved.is_active


async def test_concurrent_supplied_code_is_unique(client, db_session):
    code = f'CONCURRENT-{uuid.uuid4().hex}'
    payload = {'titulo': 'Consulta', 'cliente_id': CARLOS, 'codigo_interno': code}
    responses = await asyncio.gather(*[client.post('/api/v1/asuntos', json=payload) for _ in range(2)])
    assert sorted(r.status_code for r in responses) == [201, 409]
    assert await db_session.scalar(select(func.count()).select_from(Asunto).where(Asunto.codigo_interno == code)) == 1


def new_client_payload():
    suffix = uuid.uuid4().hex[:10]
    return {'numero_documento': suffix, 'nombre': 'Cliente transaccional', 'email': f'{suffix}@example.com'}


async def test_generated_collision_retries_without_losing_pending_client(case, client, db_session, monkeypatch):
    tokens = iter([case['codigo_interno'].split('-')[-1], uuid.uuid4().hex[:6]])
    monkeypatch.setattr(service_module, 'token_hex', lambda _: next(tokens))
    profile = new_client_payload()
    response = await client.post('/api/v1/asuntos/apertura', json={'titulo': 'Nuevo contrato', 'cliente_nuevo': profile})
    assert response.status_code == 201, response.text
    assert response.json()['codigo_interno'] != case['codigo_interno']
    assert await db_session.scalar(select(func.count()).select_from(Cliente).where(Cliente.email == profile['email'])) == 1


async def test_official_reference_is_reused_when_attaching_and_completing_guide(client):
    response = await client.post('/api/v1/asuntos', json={
        'titulo': 'Negociación de deudas', 'cliente_id': CARLOS, 'radicado_oficial': 'RAD-2026-88',
    })
    assert response.status_code == 201
    case = response.json()
    try:
        attached = await client.post(f"/api/v1/asuntos/{case['id']}/guia", json={'ruta_codigo': GUIA})
        assert attached.status_code == 200
        assert attached.json()['pasos'][2]['datos']['radicado_oficial'] == 'RAD-2026-88'
        advance = f"/api/v1/asuntos/{case['id']}/flujo/avanzar"
        for code, data in [
            ('recepcion_evaluacion', {'identidad_verificada': True, 'viabilidad_preliminar': 'viable', 'observaciones': 'Verificado.'}),
            ('preparacion_solicitud', {'documentacion_completa': True, 'solicitud_revisada': True, 'observaciones': 'Revisado.'}),
        ]:
            result = await client.post(advance, json={'paso_codigo': code, 'datos': data})
            assert result.status_code == 200, result.text
        for value in [None, 'OTRO-88']:
            changed = await client.post(advance, json={'paso_codigo': 'radicacion', 'datos': {'radicado_oficial': value}})
            assert changed.status_code == 409
        result = await client.post(advance, json={'paso_codigo': 'radicacion', 'datos': {
            'autoridad': 'Centro de conciliación', 'fecha_radicacion': '2026-10-14',
        }})
        assert result.status_code == 200, result.text
        assert result.json()['radicado_oficial'] == 'RAD-2026-88'
        assert result.json()['pasos'][2]['datos']['radicado_oficial'] == 'RAD-2026-88'
    finally:
        await client.delete(f"/api/v1/asuntos/{case['id']}")


async def test_open_rejects_foreign_and_archived_relations(case, client, db_session):
    foreign_firma = uuid.uuid4()
    lawyer = User(firma_id=foreign_firma, nombre='Abogado externo', email=f'{uuid.uuid4().hex}@example.com', cedula=uuid.uuid4().hex, rol='abogado')
    foreign_client = Cliente(firma_id=foreign_firma, nombre='Cliente externo', email=f'{uuid.uuid4().hex}@example.com',
        numero_documento='987654', numero_documento_normalizado='987654')
    db_session.add_all([lawyer, foreign_client])
    await db_session.flush()
    foreign_case = Asunto(firma_id=foreign_firma, cliente_id=foreign_client.id, abogado_id=lawyer.id,
        titulo='Expediente externo', codigo_interno=case['codigo_interno'])
    db_session.add(foreign_case)
    await db_session.commit()
    for payload in [{'cliente_id': str(foreign_client.id)}, {'cliente_id': CARLOS, 'abogado_id': str(lawyer.id)}]:
        response = await client.post('/api/v1/asuntos', json={'titulo': 'Consulta', **payload})
        assert response.status_code == 404
    assert (await client.get(f'/api/v1/asuntos/id/{foreign_case.id}')).status_code == 404
    assert (await client.post(f'/api/v1/asuntos/{foreign_case.id}/guia', json={'ruta_codigo': GUIA})).status_code == 404
    # La misma identidad interna en otra firma sí es válida.
    own = await db_session.get(Asunto, uuid.UUID(case['id']))
    own_client = Cliente(firma_id=own.firma_id,
        nombre='Cliente archivado', email=f'{uuid.uuid4().hex}@example.com', numero_documento=uuid.uuid4().hex,
        numero_documento_normalizado=uuid.uuid4().hex, is_active=False)
    db_session.add(own_client)
    await db_session.commit()
    assert (await client.post('/api/v1/asuntos', json={'titulo': 'Consulta', 'cliente_id': str(own_client.id)})).status_code == 404


@pytest.mark.parametrize('failure_stage', ['workflow', 'reload', 'commit'])
async def test_open_failure_rolls_back_client_portal_case_steps_and_task(client, db_session, monkeypatch, failure_stage):
    async def fail(*args, **kwargs):
        raise RuntimeError('Fallo intermedio simulado')

    if failure_stage == 'commit':
        from sqlalchemy.ext.asyncio import AsyncSession
        monkeypatch.setattr(AsyncSession, 'commit', fail)
    else:
        monkeypatch.setattr(AsuntoRepository, 'stage_workflow' if failure_stage == 'workflow' else 'get_by_id', fail)
    profile = new_client_payload()
    title = f"Contrato {profile['numero_documento']}"
    with pytest.raises(RuntimeError, match='simulado'):
        await client.post('/api/v1/asuntos/apertura', json={
            'titulo': title, 'cliente_nuevo': profile, 'ruta_codigo': GUIA,
        })
    assert await db_session.scalar(select(func.count()).select_from(Cliente).where(Cliente.email == profile['email'])) == 0
    assert await db_session.scalar(select(func.count()).select_from(User).where(User.email == profile['email'])) == 0
    assert await db_session.scalar(select(func.count()).select_from(Asunto).where(Asunto.titulo == title)) == 0
    # Las FK no permiten que sobrevivan pasos o tareas sin el asunto revertido.


async def test_retry_exhaustion_rolls_back_new_client(case, client, db_session, monkeypatch):
    monkeypatch.setattr(service_module, 'token_hex', lambda _: case['codigo_interno'].split('-')[-1])
    profile = new_client_payload()
    response = await client.post('/api/v1/asuntos/apertura', json={'titulo': 'Consulta', 'cliente_nuevo': profile})
    assert response.status_code == 503
    assert await db_session.scalar(select(func.count()).select_from(Cliente).where(Cliente.email == profile['email'])) == 0


async def test_detail_beyond_first_hundred(case, client, db_session):
    seed = await db_session.get(Asunto, uuid.UUID(case['id']))
    for number in range(105):
        db_session.add(Asunto(
            firma_id=seed.firma_id, cliente_id=seed.cliente_id, abogado_id=seed.abogado_id,
            titulo=f'Expediente de volumen {number}', codigo_interno=f'VOLUMEN-{uuid.uuid4().hex}',
        ))
    await db_session.commit()
    rows = (await client.get('/api/v1/asuntos')).json()
    assert len(rows) == 100
    result = await db_session.execute(select(Asunto.id).where(Asunto.firma_id == seed.firma_id, Asunto.is_active.is_(True)))
    missing = next(str(id_) for id_ in result.scalars() if str(id_) not in {item['id'] for item in rows})
    response = await client.get(f'/api/v1/asuntos/id/{missing}')
    assert response.status_code == 200
    assert response.json()['id'] == missing
    # No dejar que los datos de volumen cambien los límites de las otras suites.
    from sqlalchemy import update
    await db_session.execute(update(Asunto).where(Asunto.titulo.like('Expediente de volumen %')).values(is_active=False))
    await db_session.commit()
