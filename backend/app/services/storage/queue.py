from redis.asyncio import Redis

from app.config import settings

HEARTBEAT = "asuntia:storage:worker"


async def storage_worker_ready() -> bool:
    client = Redis.from_url(settings.REDIS_URL, socket_connect_timeout=1, socket_timeout=1)
    try:
        return bool(await client.get(HEARTBEAT))
    except Exception:
        return False
    finally:
        await client.aclose()
