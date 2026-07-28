import uuid
from datetime import datetime
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

    async def save_google_oauth_tokens(
        self,
        access_token_encrypted: str,
        refresh_token_encrypted: str | None,
        expires_at: datetime | None,
    ) -> FirmaStorageConfig:
        config = await self.get_config()
        if not config:
            config = FirmaStorageConfig(
                firma_id=self.firma_id,
                provider="google_drive",
                auth_type="oauth2",
                root_folder_name="Asuntia_Expedientes",
                is_active=True,
            )
        config.provider = "google_drive"
        config.auth_type = "oauth2"
        config.oauth_access_token_encrypted = access_token_encrypted
        if refresh_token_encrypted:
            config.oauth_refresh_token_encrypted = refresh_token_encrypted
        config.oauth_token_expires_at = expires_at
        config.is_active = True
        self.session.add(config)
        await self.session.commit()
        await self.session.refresh(config)
        return config

    async def update_google_tokens(
        self,
        config: FirmaStorageConfig,
        access_token_encrypted: str,
        refresh_token_encrypted: str | None,
        expires_at: datetime | None,
    ) -> None:
        config.oauth_access_token_encrypted = access_token_encrypted
        if refresh_token_encrypted:
            config.oauth_refresh_token_encrypted = refresh_token_encrypted
        config.oauth_token_expires_at = expires_at
        self.session.add(config)
        await self.session.commit()

    async def set_root_folder_id(
        self, config: FirmaStorageConfig, root_folder_id: str
    ) -> None:
        config.root_folder_id = root_folder_id
        self.session.add(config)
        await self.session.commit()
