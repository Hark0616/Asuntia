import uuid
from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, StringConstraints
from typing import Annotated
from app.schemas.base import BaseSchemaResponse

FirmaSlug = Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, min_length=1, max_length=100)]


def nonblank_password(value: str) -> str:
    if not value.strip():
        raise ValueError("La contraseña no puede estar vacía")
    return value


NewPassword = Annotated[str, Field(min_length=12, max_length=128), AfterValidator(nonblank_password)]


class OTPRequest(BaseModel):
    cedula: str = Field(min_length=1, max_length=50)
    firma_slug: FirmaSlug

class OTPVerify(BaseModel):
    cedula: str = Field(min_length=1, max_length=50)
    code: str = Field(max_length=128)
    firma_slug: FirmaSlug

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)
    firma_slug: FirmaSlug

class UserResponse(BaseSchemaResponse):
    id: uuid.UUID
    email: str
    nombre: str
    cedula: str
    rol: str
    firma_id: uuid.UUID

class SessionResponse(BaseModel):
    user: UserResponse


class AccessRequestResponse(BaseSchemaResponse):
    message: str
    expires_in_seconds: int


class PasswordResetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    firma_slug: FirmaSlug
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    model_config = ConfigDict(extra="forbid")
    firma_slug: FirmaSlug
    challenge_id: uuid.UUID
    token: str = Field(min_length=43, max_length=43)
    password: NewPassword
