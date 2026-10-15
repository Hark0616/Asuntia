import uuid
from datetime import datetime

from sqlalchemy import func, or_, select

from app.models.storage import StorageConnection, StorageOperation
from app.repositories.base import BaseRepository


class StorageConnectionRepository(BaseRepository[StorageConnection]):
    def __init__(self, session, firma_id: uuid.UUID):
        super().__init__(StorageConnection, session, firma_id)

    async def get_by_id(self, id):
        result = await self.session.execute(select(StorageConnection).where(
            StorageConnection.id == id, StorageConnection.firma_id == self.firma_id,
            StorageConnection.is_active.is_(True)).execution_options(populate_existing=True))
        return result.scalars().first()

    async def get_locked(self, id: uuid.UUID, *, include_inactive=False):
        stmt = select(StorageConnection).where(StorageConnection.id == id, StorageConnection.firma_id == self.firma_id)
        if not include_inactive:
            stmt = stmt.where(StorageConnection.is_active.is_(True))
        result = await self.session.execute(stmt.with_for_update().execution_options(populate_existing=True))
        return result.scalars().first()

    async def find_drive(self, provider: str, drive_id: str):
        # Solo para reconectar una identidad histórica sin cambiar sus documentos.
        result = await self.session.execute(select(StorageConnection).where(
            StorageConnection.firma_id == self.firma_id, StorageConnection.provider == provider,
            StorageConnection.drive_id == drive_id).execution_options(populate_existing=True))
        return result.scalars().first()

    async def list_connections(self):
        result = await self.session.execute(select(StorageConnection).where(
            StorageConnection.firma_id == self.firma_id).order_by(StorageConnection.created_at))
        return list(result.scalars().all())


class StorageOperationRepository(BaseRepository[StorageOperation]):
    def __init__(self, session, firma_id: uuid.UUID):
        super().__init__(StorageOperation, session, firma_id)

    async def pending_counts(self, user_id, now):
        result = await self.session.execute(select(func.count(StorageOperation.id),
            func.count(StorageOperation.id).filter(StorageOperation.user_id == user_id)).where(
            StorageOperation.firma_id == self.firma_id, StorageOperation.is_active.is_(True),
            StorageOperation.status.in_(("queued", "running", "awaiting_authorization")),
            StorageOperation.expires_at > now))
        return result.one()

    async def get_locked(self, id: uuid.UUID):
        result = await self.session.execute(select(StorageOperation).where(
            StorageOperation.id == id, StorageOperation.firma_id == self.firma_id,
            StorageOperation.is_active.is_(True)).with_for_update().execution_options(populate_existing=True))
        return result.scalars().first()

    async def ready(self, now: datetime):
        result = await self.session.execute(select(StorageOperation).where(
            StorageOperation.firma_id == self.firma_id, StorageOperation.is_active.is_(True),
            or_((StorageOperation.status == "queued") & or_(StorageOperation.lease_until.is_(None), StorageOperation.lease_until < now),
                (StorageOperation.status == "running") & (StorageOperation.lease_until < now),
                (StorageOperation.status == "awaiting_authorization") & (StorageOperation.expires_at < now)))
            .order_by(StorageOperation.created_at).limit(50))
        return list(result.scalars().all())

    async def expired_transfers(self, now: datetime):
        result = await self.session.execute(select(StorageOperation).where(
            StorageOperation.firma_id == self.firma_id, StorageOperation.is_active.is_(True),
            StorageOperation.expires_at < now,
            StorageOperation.status.in_(("completed", "failed")),
            StorageOperation.payload["_transfers_cleared"].as_boolean().is_not(True)).limit(100))
        return list(result.scalars().all())
