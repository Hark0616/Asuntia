"""Citas independientes: oficina, concurrencia, historial y agenda canónica."""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cita import Cita, CitaCambio
from app.models.asunto_paso import AsuntoPaso
from app.models.user import User

pytestmark = pytest.mark.asyncio
ABOGADO = '00000000-0000-0000-0000-000000000011'
AUXILIAR = '00000000-0000-0000-0000-000000000012'
ADMIN = '00000000-0000-0000-0000-000000000010'
CLIENTE = '00000000-0000-0000-0000-000000000020'


@pytest_asyncio.fixture
async def expediente(client):
    response = await client.post('/api/v1/asuntos', json={
        'titulo': 'Citas de prueba', 'cliente_id': CLIENTE, 'abogado_id': ABOGADO,
        'ruta_codigo': 'insolvencia_persona_natural:v2',
    })
    assert response.status_code == 201, response.text
    yield response.json()
    await client.delete(f"/api/v1/asuntos/{response.json()['id']}")


def datos(case, **changes):
    return {'asunto_id': case['id'], 'operacion_id': str(uuid.uuid4()), 'tipo': 'audiencia',
        'titulo': 'Audiencia de prueba', 'inicio': '2026-10-30T09:00:00-05:00', 'fin': '2026-10-30T10:00:00-05:00',
        'zona_horaria': 'America/Bogota', 'responsable_id': ABOGADO, 'participantes_ids': [AUXILIAR],
        'enlace': 'https://meet.example.com/prueba', 'lugar': None, 'resumen': 'Preparar soportes', **changes}


async def crear(api, case, **changes):
    payload = datos(case, **changes)
    response = await api.post('/api/v1/citas', json=payload)
    assert response.status_code == 201, response.text
    return response.json(), payload


def edicion(body, **changes):
    return {key: value for key, value in {**body, 'expected_updated_at': body['updated_at'], **changes}.items()
            if key in {'tipo','titulo','inicio','fin','zona_horaria','responsable_id','participantes_ids','lugar','enlace','resumen','expected_updated_at'}}


@pytest.mark.parametrize('rol', ['admin', 'abogado', 'auxiliar'])
async def test_oficina_crea_varias_citas_privadas_y_participantes(client, alejandro_client, sandra_client, carlos_client, expediente, rol):
    api = {'admin': client, 'abogado': alejandro_client, 'auxiliar': sandra_client}[rol]
    body, payload = await crear(api, expediente)
    otra, _ = await crear(api, expediente, tipo='reunion')
    assert body['id'] != otra['id'] and body['estado'] == 'programada'
    assert body['participantes_ids'] == [AUXILIAR] and body['created_by_id']
    assert body['inicio'] == '2026-10-30T14:00:00Z'
    current = await api.get(f"/api/v1/citas/asunto/{expediente['id']}")
    assert {item['id'] for item in current.json()} == {body['id'], otra['id']}
    assert (await carlos_client.get(f"/api/v1/citas/{body['id']}")).status_code == 403
    portal = (await carlos_client.get('/api/v1/portal/asuntos')).text
    assert body['id'] not in portal and 'Preparar soportes' not in portal


async def test_reprogramar_cancelar_conserva_historial_y_no_reescribe_guia(client, sandra_client, expediente, db_session):
    body, payload = await crear(client, expediente)
    paso = await db_session.scalar(select(AsuntoPaso).where(AsuntoPaso.asunto_id == uuid.UUID(expediente['id']), AsuntoPaso.codigo == 'agendar_audiencia'))
    paso.datos = {'cita_id': body['id'], 'cita_snapshot': {'inicio': body['inicio']}}
    await db_session.commit()
    changed = await sandra_client.put(f"/api/v1/citas/{body['id']}", json=edicion(body, inicio='2026-10-31T23:30:00-05:00', fin='2026-11-01T00:30:00-05:00', enlace=None))
    assert changed.status_code == 200, changed.text
    assert changed.json()['enlace'] is None
    await db_session.refresh(paso)
    assert paso.datos['cita_snapshot']['inicio'] == body['inicio']
    stale = await client.put(f"/api/v1/citas/{body['id']}", json=edicion(body, titulo='Obsoleto'))
    assert stale.status_code == 409
    cancel = await client.post(f"/api/v1/citas/{body['id']}/cancelar", json={'expected_updated_at': changed.json()['updated_at'], 'motivo': 'Cambio de programación'})
    assert cancel.status_code == 200 and cancel.json()['estado'] == 'cancelada'
    assert (await client.get(f"/api/v1/citas/asunto/{expediente['id']}")).json()[0]['estado'] == 'cancelada'
    history = (await client.get(f"/api/v1/citas/{body['id']}/historial")).json()
    assert [item['accion'] for item in history] == ['creada','reprogramada','cancelada']
    assert history[1]['datos']['antes']['enlace'] == payload['enlace']
    assert (await client.put(f"/api/v1/citas/{body['id']}", json=edicion(cancel.json()))).status_code == 409
    agenda = await client.get('/api/v1/tareas/agenda', params={'alcance': 'equipo', 'desde':'2026-10-30T00:00:00Z','hasta':'2026-11-02T00:00:00Z'})
    assert body['id'] not in str(agenda.json())


async def test_solicitud_recuperable_y_dos_ediciones_simultaneas(client, sandra_client, expediente):
    payload = datos(expediente)
    first, retry = await asyncio.gather(client.post('/api/v1/citas', json=payload), sandra_client.post('/api/v1/citas', json=payload))
    # La operación pertenece también al actor: reutilizarla desde otro actor es conflicto.
    assert sorted([first.status_code, retry.status_code]) == [201,409]
    winner = first if first.status_code == 201 else retry
    api = client if first.status_code == 201 else sandra_client
    repeated = await api.post('/api/v1/citas', json=payload)
    assert repeated.status_code == 201 and repeated.json()['id'] == winner.json()['id']
    assert (await api.post('/api/v1/citas', json={**payload,'titulo':'Otros datos'})).status_code == 409
    body = repeated.json()
    a, b = await asyncio.gather(client.put(f"/api/v1/citas/{body['id']}", json=edicion(body, titulo='Primera')),
                                sandra_client.put(f"/api/v1/citas/{body['id']}", json=edicion(body, titulo='Segunda')))
    assert sorted([a.status_code,b.status_code]) == [200,409]
    assert len((await client.get(f"/api/v1/citas/{body['id']}/historial")).json()) == 2


@pytest.mark.parametrize('change', [
    {'inicio':'2026-10-30T09:00:00'}, {'fin':None}, {'fin':'2026-10-30T09:00:00-05:00'},
    {'fin':'2026-11-01T09:00:00-05:00'}, {'zona_horaria':'Zona/Inexistente'}, {'titulo':'   '},
    {'enlace':'javascript:alert(1)'}, {'enlace':'http://meet.example.com'}, {'enlace':'https://a:b@example.com'},
    {'enlace':'https://example.com:wrong/'}, {'tipo':'otro'}, {'participantes_ids':[None]},
    {'publicado_al_cliente':True}, {'estado':'cancelada'}, {'created_by_id':ADMIN}, {'resumen':'a'*4001},
])
async def test_validaciones_no_guardan_datos_invalidos(client, expediente, change):
    assert (await client.post('/api/v1/citas', json=datos(expediente, **change))).status_code == 422
    assert (await client.get(f"/api/v1/citas/asunto/{expediente['id']}")).json() == []


@pytest.mark.parametrize('who,status', [(CLIENTE,404), ('00000000-0000-0000-0000-000000009999',404)])
async def test_participantes_deben_ser_oficina_activa(client, expediente, who, status):
    assert (await client.post('/api/v1/citas', json=datos(expediente, participantes_ids=[who]))).status_code == status


async def test_acceso_anonimo_no_asignado_archivo_y_recurso_ausente(client, anonymous_client, alejandro_client, expediente):
    body, _ = await crear(client, expediente)
    assert (await anonymous_client.get(f"/api/v1/citas/{body['id']}")).status_code == 401
    assert (await anonymous_client.post('/api/v1/citas', json=datos(expediente))).status_code == 401
    assert (await client.get(f'/api/v1/citas/{uuid.uuid4()}')).status_code == 404
    assert (await client.get(f"/api/v1/citas/{uuid.uuid4()}/historial")).status_code == 404
    assert (await client.post('/api/v1/citas', json=datos(expediente, asunto_id=str(uuid.uuid4())))).status_code == 404
    transfer = await client.patch(f"/api/v1/asuntos/{expediente['id']}/responsable", json={'responsable_id':ADMIN})
    assert transfer.status_code == 200, transfer.text
    for suffix in ['', '/historial']:
        assert (await alejandro_client.get(f"/api/v1/citas/{body['id']}{suffix}")).status_code == 404
    current = (await client.get(f"/api/v1/citas/{body['id']}")).json()
    assert current['responsable_id'] == ADMIN
    assert (await client.delete(f"/api/v1/asuntos/{expediente['id']}")).status_code == 204
    assert (await client.get(f"/api/v1/citas/{body['id']}")).status_code == 404
    assert (await client.put(f"/api/v1/citas/{body['id']}", json=edicion(current))).status_code == 404
    assert (await client.post(f"/api/v1/citas/{body['id']}/cancelar", json={'expected_updated_at':current['updated_at'],'motivo':'Prueba'})).status_code == 404


async def test_citas_participan_en_agenda_y_solapan_ventanas(client, sandra_client, alejandro_client, expediente):
    body, _ = await crear(client, expediente, inicio='2026-10-31T23:30:00-05:00', fin='2026-11-01T00:30:00-05:00')
    window = {'desde':'2026-11-01T05:00:00Z','hasta':'2026-11-01T06:00:00Z'}
    for api in [sandra_client, alejandro_client]:
        response = await api.get('/api/v1/tareas/agenda', params=window)
        assert response.status_code == 200
        assert body['id'] in str(response.json())
    assert (await sandra_client.get('/api/v1/tareas/agenda', params={**window,'alcance':'equipo'})).status_code == 200
    assert (await alejandro_client.get('/api/v1/tareas/agenda', params={**window,'alcance':'equipo'})).status_code == 403
    # El extremo final es exclusivo.
    excluded = await sandra_client.get('/api/v1/tareas/agenda', params={'desde':'2026-11-01T05:30:00Z','hasta':'2026-11-01T06:30:00Z'})
    assert body['id'] not in str(excluded.json())


async def test_fallo_commit_revierte_cita_e_historial(client, expediente, db_session, monkeypatch):
    payload = datos(expediente)
    async def failed(_self):
        raise RuntimeError('Fallo controlado')
    with monkeypatch.context() as context:
        context.setattr(AsyncSession, 'commit', failed)
        with pytest.raises(RuntimeError, match='Fallo controlado'):
            await client.post('/api/v1/citas', json=payload)
    assert await db_session.scalar(select(Cita).where(Cita.operacion_id == uuid.UUID(payload['operacion_id']))) is None
    assert (await client.get(f"/api/v1/citas/asunto/{expediente['id']}")).json() == []


async def test_cancelacion_valida_version_y_motivo(client, expediente):
    body, _ = await crear(client, expediente)
    for payload in [{}, {'expected_updated_at':body['updated_at'],'motivo':'   '}, {'expected_updated_at':None,'motivo':'Prueba'}]:
        assert (await client.post(f"/api/v1/citas/{body['id']}/cancelar", json=payload)).status_code == 422
    assert (await client.post(f"/api/v1/citas/{uuid.uuid4()}/cancelar", json={'expected_updated_at':body['updated_at'],'motivo':'Prueba'})).status_code == 404


async def test_aislamiento_de_firma_y_miembro_inactivo(client, expediente, db_session):
    foreign = User(firma_id=uuid.uuid4(), email=f'{uuid.uuid4()}@example.com', nombre='Otro equipo',
                   cedula=uuid.uuid4().hex, rol='auxiliar', is_active=True)
    inactive = User(firma_id=uuid.UUID('00000000-0000-0000-0000-000000000001'), email=f'{uuid.uuid4()}@example.com',
                    nombre='Baja', cedula=uuid.uuid4().hex, rol='auxiliar', is_active=False)
    db_session.add_all([foreign,inactive]); await db_session.commit()
    for member in [foreign,inactive]:
        assert (await client.post('/api/v1/citas', json=datos(expediente, participantes_ids=[str(member.id)]))).status_code == 404
    body, _ = await crear(client, expediente)
    cita = await db_session.get(Cita, uuid.UUID(body['id']))
    cita.firma_id = foreign.firma_id
    await db_session.commit()
    assert (await client.get(f"/api/v1/citas/{body['id']}")).status_code == 404
    assert (await client.get(f"/api/v1/citas/{body['id']}/historial")).status_code == 404
    assert (await client.get(f"/api/v1/citas/asunto/{expediente['id']}")).json() == []


async def test_guia_referencia_cita_y_rechaza_reunion_cancelada_y_otro_asunto(client, expediente):
    endpoint = f"/api/v1/asuntos/{expediente['id']}/flujo/avanzar"
    for codigo, data in [
        ('recepcion_evaluacion',{'identidad_verificada':True,'viabilidad_preliminar':'viable','observaciones':'Revisado'}),
        ('preparacion_solicitud',{'documentacion_completa':True,'solicitud_revisada':True,'observaciones':'Revisado'}),
        ('radicacion',{'radicado_oficial':'JUZ-CITA','autoridad':'Notaría','fecha_radicacion':'2026-10-15'}),
    ]:
        response = await client.post(endpoint,json={'paso_codigo':codigo,'datos':data})
        assert response.status_code == 200, response.text
    reunion,_ = await crear(client, expediente, tipo='reunion')
    audiencia,_ = await crear(client, expediente)
    canceled,_ = await crear(client, expediente)
    await client.post(f"/api/v1/citas/{canceled['id']}/cancelar",json={'expected_updated_at':canceled['updated_at'],'motivo':'Prueba'})
    for cita_id,status in [(reunion['id'],409),(canceled['id'],409),(str(uuid.uuid4()),404)]:
        rejected = await client.post(endpoint,json={'paso_codigo':'agendar_audiencia','datos':{'cita_id':cita_id}})
        assert rejected.status_code == status, rejected.text
    accepted = await client.post(endpoint,json={'paso_codigo':'agendar_audiencia','datos':{'cita_id':audiencia['id']}})
    assert accepted.status_code == 200, accepted.text
    step = next(paso for paso in accepted.json()['pasos'] if paso['codigo'] == 'agendar_audiencia')
    assert step['datos']['cita_id'] == audiencia['id']
    assert step['datos']['cita_snapshot']['inicio'].startswith('2026-10-30T14:00:00')
    assert len((await client.get(f"/api/v1/citas/asunto/{expediente['id']}")).json()) == 3
    changed_type = await client.put(f"/api/v1/citas/{audiencia['id']}",json=edicion(audiencia,tipo='reunion'))
    assert changed_type.status_code == 409


async def test_baja_de_auxiliar_exige_y_transfiere_sus_citas(client, expediente, db_session):
    member = User(firma_id=uuid.UUID('00000000-0000-0000-0000-000000000001'), email=f'{uuid.uuid4()}@example.com',
                  nombre='Auxiliar temporal', cedula=uuid.uuid4().hex, rol='auxiliar', is_active=True)
    db_session.add(member); await db_session.commit()
    future = datetime.now(timezone.utc) + timedelta(days=10)
    body,_ = await crear(client, expediente, responsable_id=str(member.id), participantes_ids=[str(member.id)],
                         inicio=future.isoformat(), fin=(future+timedelta(hours=1)).isoformat())
    payload = {'expected_updated_at':member.updated_at.isoformat()}
    denied = await client.post(f'/api/v1/equipo/{member.id}/desactivar',json=payload)
    assert denied.status_code == 409, denied.text
    accepted = await client.post(f'/api/v1/equipo/{member.id}/desactivar',json={**payload,'reasignar_a_id':ADMIN})
    assert accepted.status_code == 200, accepted.text
    current = (await client.get(f"/api/v1/citas/{body['id']}")).json()
    assert current['responsable_id'] == ADMIN and current['participantes_ids'] == [ADMIN]
    assert (await client.get(f"/api/v1/citas/{body['id']}/historial")).json()[-1]['accion'] == 'transferida'
