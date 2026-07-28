import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock
from app.models.firma_storage import FirmaStorageConfig
from app.services.storage.factory import StorageFactory
from app.services.storage.local_storage import LocalStorageService
from app.services.storage.google_drive import GoogleDriveStorageService
from app.services.storage.token_cipher import StorageTokenCipher

DEFAULT_FIRMA_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

@pytest.mark.asyncio
async def test_storage_factory_default_fallback():
    """
    Verifica que la factoría use almacenamiento local si la firma no ha configurado proveedor.
    """
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars().first.return_value = None
    mock_session.execute.return_value = mock_result

    provider = await StorageFactory.get_provider_for_firma(mock_session, DEFAULT_FIRMA_ID)
    assert isinstance(provider, LocalStorageService)

@pytest.mark.asyncio
async def test_storage_factory_local_provider():
    """
    Verifica que la factoría devuelva LocalStorageService si la firma configuró 'local'.
    """
    mock_config = FirmaStorageConfig(
        id=uuid.uuid4(),
        firma_id=DEFAULT_FIRMA_ID,
        provider="local",
        auth_type="local",
        is_active=True
    )

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars().first.return_value = mock_config
    mock_session.execute.return_value = mock_result

    provider = await StorageFactory.get_provider_for_firma(mock_session, DEFAULT_FIRMA_ID)
    assert isinstance(provider, LocalStorageService)


@pytest.mark.asyncio
async def test_storage_factory_google_provider():
    cipher = StorageTokenCipher()
    mock_config = FirmaStorageConfig(
        id=uuid.uuid4(),
        firma_id=DEFAULT_FIRMA_ID,
        provider="google_drive",
        auth_type="oauth2",
        oauth_access_token_encrypted=cipher.encrypt("access-token"),
        is_active=True,
    )
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars().first.return_value = mock_config
    mock_session.execute.return_value = mock_result

    provider = await StorageFactory.get_provider_for_firma(
        mock_session, DEFAULT_FIRMA_ID
    )
    assert isinstance(provider, GoogleDriveStorageService)

@pytest.mark.asyncio
async def test_local_storage_service_creation_and_folders(tmp_path):
    """
    Prueba la creación de la estructura de 4 carpetas en LocalStorageService.
    """
    service = LocalStorageService(base_path=str(tmp_path))
    res = await service.create_case_folder_structure("AS-2026-TEST")

    assert "root_folder_id" in res
    assert "subfolders" in res
    assert "anexo" in res["subfolders"]
    assert "solicitud" in res["subfolders"]
    assert "audiencia" in res["subfolders"]
    assert "liquidacion" in res["subfolders"]
