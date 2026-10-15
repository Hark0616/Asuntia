import uuid
from pydantic import BaseModel, EmailStr, StringConstraints
from typing import Annotated
from app.schemas.base import BaseSchemaResponse

FirmaSlug = Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, min_length=1, max_length=100)]


class OTPRequest(BaseModel):
    cedula: str
    firma_slug: FirmaSlug

class OTPVerify(BaseModel):
    cedula: str
    code: str
    firma_slug: FirmaSlug

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
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
