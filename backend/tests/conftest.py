import asyncpg
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.models  # noqa: F401
import app.seed as seed_module
from app.core.db import get_db
from app.main import app
from app.models.base import Base


TEST_DATABASE_NAME = "asuntia_test"
TEST_DATABASE_URL = (
    f"postgresql+asyncpg://asuntia:asuntia_dev@localhost:5432/{TEST_DATABASE_NAME}"
)

engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
TestingSessionLocal = async_sessionmaker(
    engine, expire_on_commit=False, class_=AsyncSession
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
        host="localhost",
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
        json={"firma_slug": "demo", "cedula": cedula, "code": "123456"},
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
async def elena_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as api_client:
        await _login_client(api_client, "52.391.804")
        yield api_client
