"""Búsqueda paginada, resúmenes ligeros y alcance por firma y responsable."""
from datetime import datetime, timezone
import uuid

import pytest
import pytest_asyncio
from sqlalchemy import event, update

from app.models.asunto import Asunto
from app.models.cliente import Cliente
from app.models.estado import EstadoProcesal
from app.models.user import User
from app.repositories.asunto_repository import AsuntoRepository
from app.repositories.cliente_repository import ClienteRepository


CARLOS = uuid.UUID('00000000-0000-0000-0000-000000000020')
ADMIN = uuid.UUID('00000000-0000-0000-0000-000000000010')
ABOGADO = uuid.UUID('00000000-0000-0000-0000-000000000011')
ESTADO = uuid.UUID('00000000-0000-0000-0000-000000000102')
PATH = '/api/v1/asuntos/busqueda'


@pytest_asyncio.fixture
async def dataset(db_session):
    client = await db_session.get(Cliente, CARLOS)
    firma = client.firma_id
    prefix = f'BUSQUEDA-{uuid.uuid4().hex[:10]}'
    cases = []
    for number in range(121):
        case = Asunto(
            id=uuid.uuid4(), firma_id=firma, cliente_id=CARLOS,
            abogado_id=ABOGADO if number % 2 else ADMIN,
            estado_id=ESTADO if number % 3 == 0 else None,
            titulo=f'{prefix} Contrato {number:03}', codigo_interno=f'{prefix}-{number:03}',
            radicado_oficial=f'JUZ-{prefix}-{number:03}',
            created_at=datetime(2026, 10, 14, 12, tzinfo=timezone.utc),
        )
        db_session.add(case)
        cases.append(case)
    # Registros excluidos por archivo, firma o padre inválido.
    foreign_client = Cliente(id=uuid.uuid4(), firma_id=uuid.uuid4(), nombre='Cliente externo',
        numero_documento=uuid.uuid4().hex, numero_documento_normalizado=uuid.uuid4().hex, email='externo@example.com')
    archived_client = Cliente(id=uuid.uuid4(), firma_id=firma, nombre='Cliente archivado', is_active=False,
        numero_documento=uuid.uuid4().hex, numero_documento_normalizado=uuid.uuid4().hex, email='archivado@example.com')
    db_session.add_all([foreign_client, archived_client])
    await db_session.flush()
    excluded = [
        Asunto(id=uuid.uuid4(), firma_id=firma, cliente_id=CARLOS, titulo=prefix, codigo_interno=f'{prefix}-ARCH', is_active=False),
        Asunto(id=uuid.uuid4(), firma_id=foreign_client.firma_id, cliente_id=foreign_client.id, titulo=prefix, codigo_interno=f'{prefix}-EXT'),
        Asunto(id=uuid.uuid4(), firma_id=firma, cliente_id=foreign_client.id, titulo=prefix, codigo_interno=f'{prefix}-CRUCE'),
        Asunto(id=uuid.uuid4(), firma_id=firma, cliente_id=archived_client.id, titulo=prefix, codigo_interno=f'{prefix}-PADRE'),
    ]
    db_session.add_all(excluded)
    await db_session.commit()
    yield {'prefix': prefix, 'cases': cases, 'firma': firma, 'foreign_client': foreign_client, 'archived_client': archived_client}
    await db_session.execute(update(Asunto).where(Asunto.id.in_([c.id for c in cases + excluded])).values(is_active=False))
    await db_session.commit()


async def test_all_pages_cover_more_than_a_hundred_in_stable_order(client, dataset):
    found = []
    for page in range(1, 6):
        response = await client.get(PATH, params={'q': dataset['prefix'], 'pagina': page, 'por_pagina': 25})
        assert response.status_code == 200, response.text
        body = response.json()
        assert body['total'] == 121
        assert body['pagina'] == page and body['por_pagina'] == 25
        assert len(body['items']) == (25 if page < 5 else 21)
        found.extend(item['id'] for item in body['items'])
    assert found == [str(c.id) for c in sorted(dataset['cases'], key=lambda c: c.id, reverse=True)]
    assert len(set(found)) == 121
    again = await client.get(PATH, params={'q': dataset['prefix'], 'pagina': 2, 'por_pagina': 25})
    assert [i['id'] for i in again.json()['items']] == found[25:50]
    detail = await client.get(f'/api/v1/asuntos/id/{found[-1]}')
    assert detail.status_code == 200
    assert detail.json()['id'] == found[-1]


async def test_out_of_range_page_keeps_total_and_empty_search_is_zero(client, dataset):
    response = await client.get(PATH, params={'q': dataset['prefix'], 'pagina': 90})
    assert response.json()['items'] == []
    assert response.json()['total'] == 121
    empty = await client.get(PATH, params={'q': uuid.uuid4().hex})
    assert empty.json()['total'] == 0 and empty.json()['items'] == []


async def test_search_reference_title_and_client_are_case_insensitive_and_literal(client, dataset):
    case = dataset['cases'][104]
    for text in [case.codigo_interno.lower(), case.radicado_oficial.lower(), case.titulo.lower()]:
        response = await client.get(PATH, params={'q': text})
        assert response.json()['total'] == 1
        assert response.json()['items'][0]['id'] == str(case.id)
    for text in ['Carlos Gómez Restrepo', '1.094.852.140']:
        response = await client.get(PATH, params={'q': text, 'cliente_id': str(CARLOS), 'por_pagina': 100})
        assert response.json()['total'] >= 121
    for text in ['%', '_', "' OR 1=1 --"]:
        response = await client.get(PATH, params={'q': text})
        assert response.json()['items'] == []


async def test_filters_and_totals_enforce_lawyer_scope(dataset, client, alejandro_client, sandra_client):
    params = {'q': dataset['prefix'], 'responsable_id': str(ABOGADO), 'por_pagina': 100}
    for api in [client, alejandro_client, sandra_client]:
        response = await api.get(PATH, params=params)
        assert response.status_code == 200
        assert response.json()['total'] == 60
        assert all(row['abogado_id'] == str(ABOGADO) for row in response.json()['items'])
    denied = await alejandro_client.get(PATH, params={**params, 'responsable_id': str(ADMIN)})
    assert denied.json()['total'] == 0
    filtered = await client.get(PATH, params={**params, 'estado_id': str(ESTADO)})
    assert filtered.json()['total'] == 20
    for client_id in [dataset['foreign_client'].id, dataset['archived_client'].id, uuid.uuid4()]:
        response = await client.get(PATH, params={'cliente_id': str(client_id)})
        assert response.json()['total'] == 0


async def test_summary_has_no_history_and_one_query_for_any_page_size(dataset, db_session):
    statements = []
    def record(connection, cursor, statement, *args):
        statements.append(statement)
    engine = db_session.bind.sync_engine
    event.listen(engine, 'before_cursor_execute', record)
    try:
        repository = AsuntoRepository(db_session, dataset['firma'])
        for size in [1, 100]:
            statements.clear()
            items, total = await repository.search(q=dataset['prefix'], pagina=1, por_pagina=size)
            assert len(statements) == 1
            assert total == 121 and len(items) == size
            assert not {'novedades', 'pasos', 'tareas', 'documentos'}.intersection(items[0])
            assert all(name not in statements[0] for name in ['asunto_pasos', 'novedades', 'documentos_asunto', 'tareas'])
    finally:
        event.remove(engine, 'before_cursor_execute', record)


async def test_directory_does_not_load_case_histories_and_counts_only_authorized_work(dataset, db_session):
    statements = []
    def record(connection, cursor, statement, *args):
        statements.append(statement)
    engine = db_session.bind.sync_engine
    event.listen(engine, 'before_cursor_execute', record)
    try:
        rows = await ClienteRepository(db_session, dataset['firma']).list(abogado_scope=ABOGADO)
        assert len(statements) == 1
        assert all(name not in statements[0] for name in ['asunto_pasos', 'novedades', 'documentos_asunto', 'tareas'])
        carlos = next(c for c in rows if c['id'] == CARLOS)
        assert carlos['asuntos_count'] >= 60
        full = await ClienteRepository(db_session, dataset['firma']).list()
        full_count = next(c['asuntos_count'] for c in full if c['id'] == CARLOS)
        assert full_count > carlos['asuntos_count']
    finally:
        event.remove(engine, 'before_cursor_execute', record)


async def test_cross_tenant_related_names_and_ids_are_not_exposed(dataset, db_session, client):
    foreign = dataset['foreign_client'].firma_id
    lawyer = User(firma_id=foreign, nombre='Responsable reservado', email=f'{uuid.uuid4().hex}@example.com',
        cedula=uuid.uuid4().hex, rol='abogado')
    state = EstadoProcesal(firma_id=foreign, nombre='Estado reservado', color_tipo='mint', orden=1)
    db_session.add_all([lawyer, state])
    await db_session.flush()
    case = dataset['cases'][0]
    case.abogado_id = lawyer.id
    case.estado_id = state.id
    await db_session.commit()
    response = await client.get(PATH, params={'q': case.codigo_interno})
    assert response.status_code == 200
    row = response.json()['items'][0]
    assert row['abogado_id'] is None and row['responsable_nombre'] is None
    assert row['estado_id'] is None and row['estado_nombre'] is None
    filtered = await client.get(PATH, params={'q': case.codigo_interno, 'estado_id': str(state.id)})
    assert filtered.json()['total'] == 0
    filtered_responsible = await client.get(PATH, params={'q': case.codigo_interno, 'responsable_id': str(lawyer.id)})
    assert filtered_responsible.json()['total'] == 0


async def test_archiving_between_pages_updates_total_without_fictional_results(dataset, db_session, client):
    first = (await client.get(PATH, params={'q': dataset['prefix'], 'por_pagina': 100})).json()
    ids = [uuid.UUID(c['id']) for c in first['items']]
    await db_session.execute(update(Asunto).where(Asunto.id.in_(ids)).values(is_active=False))
    await db_session.commit()
    second = (await client.get(PATH, params={'q': dataset['prefix'], 'pagina': 2, 'por_pagina': 100})).json()
    assert second['total'] == 21 and second['items'] == []
    refreshed = (await client.get(PATH, params={'q': dataset['prefix'], 'por_pagina': 100})).json()
    assert refreshed['total'] == 21 and len(refreshed['items']) == 21
    assert not set(first['items'][i]['id'] for i in range(100)).intersection(c['id'] for c in refreshed['items'])


@pytest.mark.parametrize('params', [
    {'pagina': 0}, {'pagina': -1}, {'pagina': 'abc'}, {'por_pagina': 0}, {'por_pagina': 101},
    {'q': 'x' * 161}, {'cliente_id': 'mal'}, {'responsable_id': 'mal'}, {'estado_id': 'mal'},
    {'sin_responsable': 'invalid'}, {'sin_responsable': 'true', 'responsable_id': str(ADMIN)},
])
async def test_invalid_filters_are_rejected(client, params):
    assert (await client.get(PATH, params=params)).status_code == 422


async def test_session_and_office_role_are_required(anonymous_client, carlos_client):
    assert (await anonymous_client.get(PATH)).status_code == 401
    assert (await carlos_client.get(PATH)).status_code == 403
