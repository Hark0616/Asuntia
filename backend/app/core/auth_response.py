import asyncio
from contextlib import asynccontextmanager
from time import monotonic

from app.config import settings


@asynccontextmanager
async def uniform_auth_response():
    """Mismo mínimo de respuesta para solicitudes de identidades conocidas o ajenas."""
    started = monotonic()
    try:
        yield
    finally:
        remaining = settings.AUTH_MIN_RESPONSE_SECONDS - (monotonic() - started)
        if remaining > 0:
            await asyncio.sleep(remaining)
