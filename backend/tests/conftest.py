import asyncpg
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.models  # noqa: F401
import app.seed as seed_module
from app.core.db import get_db
from app.main import app
from app.models.base import Base
from app.config import settings
from app.api.v1.endpoints import auth as auth_endpoints


@pytest.fixture(scope="session")
def isolated_storage_root(tmp_path_factory):
    return tmp_path_factory.mktemp("asuntia-private-storage")


@pytest.fixture(autouse=True)
def storage_test_root(monkeypatch, isolated_storage_root):
    # La BD de pruebas comparte expedientes durante la sesión, al igual que su
    # raíz temporal. Nunca escribir documentos sintéticos en el storage real.
    monkeypatch.setattr(settings, "LOCAL_STORAGE_PATH", str(isolated_storage_root))


@pytest.fixture(autouse=True)
def auth_test_budgets(monkeypatch):
    # Los recorridos de negocio reutilizan identidades seed; las pruebas de abuso
    # fijan presupuestos pequeños en firmas aisladas dentro de cada caso.
    for name in ("AUTH_LOGIN_LIMIT", "AUTH_OTP_REQUEST_LIMIT", "AUTH_VERIFY_LIMIT",
                 "AUTH_RECOVERY_REQUEST_LIMIT", "AUTH_IP_LIMIT"):
        monkeypatch.setattr(settings, name, 10000)
    monkeypatch.setattr(settings, "AUTH_MIN_RESPONSE_SECONDS", 0)

    async def capture_only(*args):
        return True

    # Ninguna prueba de negocio manda correo. El transporte tiene pruebas propias.
    monkeypatch.setattr(auth_endpoints, "send_otp_email", capture_only)
    monkeypatch.setattr(auth_endpoints, "send_password_reset_email", capture_only)
    monkeypatch.setattr(auth_endpoints, "send_password_changed_email", capture_only)


TEST_DATABASE_NAME = "asuntia_test"
TEST_DATABASE_URL = (
    f"postgresql+asyncpg://asuntia:asuntia_dev@127.0.0.1:5432/{TEST_DATABASE_NAME}"
)

engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
TestingSessionLocal = async_sessionmaker(
    engine, expire_on_commit=False, autoflush=False, class_=AsyncSession
)


async def override_get_db():
    async with TestingSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(scope="session", autouse=True)
async def prepare_test_database():
    admin_connection = await asyncpg.connect(
        user="asuntia",
        password="asuntia_dev",
        host="127.0.0.1",
        port=5432,
        database="postgres",
    )
    exists = await admin_connection.fetchval(
        "SELECT 1 FROM pg_database WHERE datname = $1", TEST_DATABASE_NAME
    )
    if not exists:
        await admin_connection.execute(f'CREATE DATABASE "{TEST_DATABASE_NAME}"')
    await admin_connection.close()

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)

    original_session_factory = seed_module.AsyncSessionLocal
    seed_module.AsyncSessionLocal = TestingSessionLocal
    try:
        await seed_module.seed_data()
    finally:
        seed_module.AsyncSessionLocal = original_session_factory

    yield

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def anonymous_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as api_client:
        yield api_client


@pytest_asyncio.fixture
async def db_session():
    async with TestingSessionLocal() as session:
        try:
            yield session
        finally:
            await session.rollback()


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as api_client:
        response = await api_client.post(
            "/api/v1/auth/login",
            json={
                "firma_slug": "demo",
                "email": "daniela.torres@asuntia.com",
                "password": "admin123",
            },
        )
        assert response.status_code == 200
        yield api_client


async def _login_client(api_client: AsyncClient, cedula: str) -> None:
    request_response = await api_client.post(
        "/api/v1/auth/otp/request",
        json={"firma_slug": "demo", "cedula": cedula},
    )
    assert request_response.status_code == 200
    verify_response = await api_client.post(
        "/api/v1/auth/otp/verify",
        json={"firma_slug": "demo", "cedula": cedula, "code": "12345"},
    )
    assert verify_response.status_code == 200


@pytest_asyncio.fixture
async def carlos_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as api_client:
        await _login_client(api_client, "1.094.852.140")
        yield api_client


@pytest_asyncio.fixture
async def alejandro_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as api_client:
        response = await api_client.post(
            "/api/v1/auth/login",
            json={
                "firma_slug": "demo",
                "email": "alejandro.morales@asuntia.com",
                "password": "admin123",
            },
        )
        assert response.status_code == 200
        yield api_client


@pytest_asyncio.fixture
async def sandra_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as api_client:
        response = await api_client.post(
            "/api/v1/auth/login",
            json={
                "firma_slug": "demo",
                "email": "sandra.perez@asuntia.com",
                "password": "admin123",
            },
        )
        assert response.status_code == 200
        yield api_client


@pytest_asyncio.fixture
async def elena_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as api_client:
        await _login_client(api_client, "52.391.804")
        yield api_client
