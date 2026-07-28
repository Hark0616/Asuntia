import uuid
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.schemas.base import BaseSchemaResponse

class OTPRequest(BaseModel):
    cedula: str
    firma_slug: str = "demo"

class OTPVerify(BaseModel):
    cedula: str
    code: str
    firma_slug: str = "demo"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    firma_slug: str = "demo"

class UserResponse(BaseSchemaResponse):
    id: uuid.UUID
    email: str
    nombre: str
    cedula: str
    rol: str
    firma_id: uuid.UUID

class SessionResponse(BaseModel):
    user: UserResponse
