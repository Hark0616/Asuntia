from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
import uuid

class FirmaStorageConfigBase(BaseModel):
    provider: str = "mock" # google_drive, onedrive, local, mock
    auth_type: str = "none" # oauth2, service_account, local, none
    root_folder_id: Optional[str] = None
    root_folder_name: Optional[str] = "Asuntia_Expedientes"
    is_active: bool = True

class FirmaStorageConfigCreate(FirmaStorageConfigBase):
    pass

class FirmaStorageConfigResponse(FirmaStorageConfigBase):
    id: uuid.UUID
    firma_id: uuid.UUID
    last_verified_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
