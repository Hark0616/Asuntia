import pytest
import pytest_asyncio
import uuid
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.db import get_db
from app.models.base import Base
from app.models.firma import Firma
from app.models.user import User
from app.models.estado import EstadoProcesal
from app.models.asunto import Asunto

# Motor de BD de prueba en memoria (SQLite Async)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

DEFAULT_FIRMA_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Sembrar datos de prueba
    async with TestingSessionLocal() as session:
        firma = Firma(id=DEFAULT_FIRMA_ID, nombre="Firma Pruebas", subdominio="test")
        session.add(firma)

        abogado = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000010"),
            firma_id=DEFAULT_FIRMA_ID,
            nombre="Dra. Daniela Torres",
            email="daniela@test.com",
            cedula="52.840.192",
            rol="abogado"
        )
        cliente = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000020"),
            firma_id=DEFAULT_FIRMA_ID,
            nombre="Carlos Gómez",
            email="carlos@test.com",
            cedula="1.094.852.140",
            rol="cliente"
        )
        session.add_all([abogado, cliente])

        estado = EstadoProcesal(
            id=uuid.UUID("00000000-0000-0000-0000-000000000101"),
            firma_id=DEFAULT_FIRMA_ID,
            nombre="Admitido",
            color_tipo="mint",
            orden=1
        )
        session.add(estado)

        asunto = Asunto(
            id=uuid.UUID("00000000-0000-0000-0000-000000000201"),
            firma_id=DEFAULT_FIRMA_ID,
            radicado="AS-2026-TEST",
            cliente_id=cliente.id,
            abogado_id=abogado.id,
            estado_id=estado.id,
            etapa_actual="Etapa 1",
            siguiente_paso="Revisar"
        )
        session.add(asunto)
        await session.commit()
    
    yield

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session

app.dependency_overrides[get_db] = override_get_db

@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
