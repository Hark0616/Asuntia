import uuid
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.base import BaseRepository
from app.models.firma_storage import FirmaStorageConfig
from app.schemas.firma_storage import FirmaStorageConfigCreate

class FirmaStorageRepository(BaseRepository[FirmaStorageConfig]):
    def __init__(self, session: AsyncSession, firma_id: uuid.UUID):
        super().__init__(model=FirmaStorageConfig, session=session, firma_id=firma_id)

    async def get_config(self) -> Optional[FirmaStorageConfig]:
        res = await self.session.execute(
            select(FirmaStorageConfig).where(FirmaStorageConfig.firma_id == self.firma_id)
        )
        return res.scalars().first()

    async def create_or_update_config(self, data: FirmaStorageConfigCreate) -> FirmaStorageConfig:
        config = await self.get_config()
        if not config:
            config = FirmaStorageConfig(
                firma_id=self.firma_id,
                **data.model_dump()
            )
            self.session.add(config)
        else:
            for field, val in data.model_dump(exclude_unset=True).items():
                setattr(config, field, val)
        await self.session.commit()
        await self.session.refresh(config)
        return config
