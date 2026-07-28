import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


class StorageTokenCipher:
    """Cifra tokens OAuth antes de persistirlos en PostgreSQL."""

    def __init__(self) -> None:
        key = settings.STORAGE_TOKEN_ENCRYPTION_KEY
        if not key:
            key = base64.urlsafe_b64encode(
                hashlib.sha256(settings.JWT_SECRET.encode("utf-8")).digest()
            ).decode("ascii")
        self.fernet = Fernet(key.encode("ascii"))

    def encrypt(self, value: str) -> str:
        return self.fernet.encrypt(value.encode("utf-8")).decode("ascii")

    def decrypt(self, value: str) -> str:
        try:
            return self.fernet.decrypt(value.encode("ascii")).decode("utf-8")
        except InvalidToken as exc:
            raise ValueError("No fue posible descifrar las credenciales de Google Drive") from exc
