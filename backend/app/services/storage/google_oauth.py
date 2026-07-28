import os
import uuid

from google_auth_oauthlib.flow import Flow
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.config import settings
from app.repositories.firma_storage_repository import FirmaStorageRepository
from app.services.storage.token_cipher import StorageTokenCipher


GOOGLE_DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"]


class GoogleOAuthService:
    def __init__(self, repository: FirmaStorageRepository):
        self.repository = repository
        self.cipher = StorageTokenCipher()
        self.serializer = URLSafeTimedSerializer(
            settings.JWT_SECRET,
            salt="asuntia-google-drive-oauth",
        )

    @staticmethod
    def _client_config() -> dict:
        if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
            raise ValueError(
                "Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET para conectar Google Drive"
            )
        return {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.GOOGLE_OAUTH_REDIRECT_URI],
            }
        }

    @staticmethod
    def _allow_http_in_development() -> None:
        if settings.ENVIRONMENT == "development":
            os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

    def create_authorization_url(
        self, firma_id: uuid.UUID, user_id: uuid.UUID
    ) -> str:
        self._allow_http_in_development()
        state = self.serializer.dumps(
            {"firma_id": str(firma_id), "user_id": str(user_id)}
        )
        flow = Flow.from_client_config(
            self._client_config(),
            scopes=GOOGLE_DRIVE_SCOPES,
            state=state,
        )
        flow.redirect_uri = settings.GOOGLE_OAUTH_REDIRECT_URI
        authorization_url, _ = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
        )
        return authorization_url

    async def exchange_code(
        self,
        code: str,
        state: str,
        firma_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        try:
            state_data = self.serializer.loads(state, max_age=600)
        except (BadSignature, SignatureExpired) as exc:
            raise ValueError("La conexión con Google expiró o no es válida") from exc
        if (
            state_data.get("firma_id") != str(firma_id)
            or state_data.get("user_id") != str(user_id)
        ):
            raise ValueError("La conexión de Google no corresponde a esta sesión")

        self._allow_http_in_development()
        flow = Flow.from_client_config(
            self._client_config(),
            scopes=GOOGLE_DRIVE_SCOPES,
            state=state,
        )
        flow.redirect_uri = settings.GOOGLE_OAUTH_REDIRECT_URI
        flow.fetch_token(code=code)
        credentials = flow.credentials
        await self.repository.save_google_oauth_tokens(
            access_token_encrypted=self.cipher.encrypt(credentials.token),
            refresh_token_encrypted=(
                self.cipher.encrypt(credentials.refresh_token)
                if credentials.refresh_token
                else None
            ),
            expires_at=credentials.expiry,
        )
