from sqlalchemy import Column, String, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class FirmaStorageConfig(BaseModel):
    __tablename__ = "firma_storage_config"

    firma_id = Column(UUID(as_uuid=True), ForeignKey("firmas.id"), nullable=False, unique=True, index=True)
    provider = Column(String(30), nullable=False, default="mock") # google_drive, onedrive, local, mock
    auth_type = Column(String(30), nullable=False, default="none") # oauth2, service_account, local, none
    oauth_refresh_token_encrypted = Column(Text, nullable=True)
    oauth_access_token_encrypted = Column(Text, nullable=True)
    oauth_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    root_folder_id = Column(String(255), nullable=True)
    root_folder_name = Column(String(255), nullable=True, default="Asuntia_Expedientes")
    is_active = Column(Boolean, nullable=False, default=True)
    last_verified_at = Column(DateTime(timezone=True), nullable=True)

    firma = relationship("Firma", backref="storage_config")
