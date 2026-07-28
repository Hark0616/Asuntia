from typing import Literal, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
import uuid

class FirmaStorageConfigBase(BaseModel):
    provider: Literal["local", "google_drive"] = "local"
    auth_type: Literal["local", "oauth2"] = "local"
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
