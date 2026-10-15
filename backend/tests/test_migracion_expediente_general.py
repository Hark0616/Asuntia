"""Ejecuta Alembic real sobre bases desechables, sin create_all."""
import asyncio
import os
from pathlib import Path
import subprocess
import sys
import uuid

import asyncpg
import pytest_asyncio


PREVIOUS = '8d5db36e435d'
CURRENT = 'f112d368f6d4'
BACKEND = Path(__file__).resolve().parents[1]


@pytest_asyncio.fixture
async def migration_db():
    name = f'asuntia_migration_test_{uuid.uuid4().hex}'
    admin = await asyncpg.connect(user='asuntia', password='asuntia_dev', host='127.0.0.1', database='postgres')
    await admin.execute(f'CREATE DATABASE "{name}"')
    try:
        yield name
    finally:
        assert name.startswith('asuntia_migration_test_') and len(name) == 55
        await admin.execute(f'DROP DATABASE "{name}" WITH (FORCE)')
        await admin.close()


async def migrate(name, *args, success=True):
    result = await asyncio.to_thread(subprocess.run,
        [sys.executable, '-m', 'alembic', *args], cwd=BACKEND,
        env={**os.environ, 'DATABASE_URL': f'postgresql+asyncpg://asuntia:asuntia_dev@127.0.0.1:5432/{name}'},
        capture_output=True, text=True,
    )
    if success:
        assert result.returncode == 0, result.stdout + result.stderr
    else:
        assert result.returncode != 0
    return result


async def connect(name):
    return await asyncpg.connect(user='asuntia', password='asuntia_dev', host='127.0.0.1', database=name)


async def legacy_data(name, duplicate=False):
    await migrate(name, 'upgrade', '512ffe7abb80')
    connection = await connect(name)
    firma, lawyer, client = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    await connection.execute("INSERT INTO firmas VALUES ($1, 'Firma prueba', 'prueba', true, now())", firma)
    for actor, role in [(lawyer, 'abogado'), (client, 'cliente')]:
        await connection.execute("""
            INSERT INTO users (id, firma_id, email, nombre, cedula, rol, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, 'Usuario prueba', $3, $4, true, now(), now())
        """, actor, firma, f'{actor}@example.com', role)
    ids = []
    for index in range(2):
        id_ = uuid.uuid4()
        ids.append(id_)
        await connection.execute("""
            INSERT INTO asuntos (id, firma_id, cliente_id, abogado_id, radicado, etapa_actual, siguiente_paso,
                is_active, created_at, updated_at, created_by_id)
            VALUES ($1, $2, $3, $4, $5, 'Etapa histórica', 'Acción histórica', $6, now(), now(), $4)
        """, id_, firma, client, lawyer, 'LEGADO-1' if duplicate else f'LEGADO-{index + 1}', index == 0)
    await connection.close()
    await migrate(name, 'upgrade', PREVIOUS)
    return ids


async def test_empty_database_full_chain_and_schema_match(migration_db):
    await migrate(migration_db, 'upgrade', 'head')
    await migrate(migration_db, 'check')
    await migrate(migration_db, 'downgrade', PREVIOUS)
    await migrate(migration_db, 'upgrade', 'head')


async def test_migration_preserves_legacy_codes_history_and_official_reference(migration_db):
    ids = await legacy_data(migration_db)
    connection = await connect(migration_db)
    await connection.execute("""
        UPDATE asunto_pasos SET estado = 'completado', datos = '{"radicado_oficial":"JUZ-2026-123"}'::jsonb
        WHERE asunto_id = $1 AND codigo = 'radicacion'
    """, ids[0])
    before_steps = await connection.fetchval('SELECT count(*) FROM asunto_pasos')
    before_tasks = await connection.fetchval('SELECT count(*) FROM tareas')
    await connection.close()
    await migrate(migration_db, 'upgrade', 'head')
    connection = await connect(migration_db)
    try:
        for index, id_ in enumerate(ids):
            row = await connection.fetchrow('SELECT * FROM asuntos WHERE id = $1', id_)
            assert row['radicado'] == f'LEGADO-{index + 1}'
            assert row['titulo'] == 'Insolvencia Persona Natural'
            assert row['is_active'] == (index == 0)
            assert row['ruta_codigo'] is not None
            assert row['radicado_oficial'] == ('JUZ-2026-123' if index == 0 else None)
        assert await connection.fetchval('SELECT count(*) FROM asunto_pasos') == before_steps
        assert await connection.fetchval('SELECT count(*) FROM tareas') == before_tasks
        assert await connection.fetchval('SELECT version_num FROM alembic_version') == CURRENT
    finally:
        await connection.close()


async def test_duplicate_legacy_codes_abort_without_partial_schema(migration_db):
    await legacy_data(migration_db, duplicate=True)
    result = await migrate(migration_db, 'upgrade', 'head', success=False)
    assert 'códigos internos duplicados' in result.stderr
    connection = await connect(migration_db)
    try:
        assert await connection.fetchval('SELECT version_num FROM alembic_version') == PREVIOUS
        assert await connection.fetchval('SELECT count(*) FROM asuntos') == 2
        assert not await connection.fetchval("""
            SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'asuntos' AND column_name = 'titulo')
        """)
    finally:
        await connection.close()
