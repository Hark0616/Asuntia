import uuid
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.schemas.base import BaseSchemaResponse

class OTPRequest(BaseModel):
    cedula: str

class OTPVerify(BaseModel):
    cedula: str
    code: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseSchemaResponse):
    id: uuid.UUID
    email: str
    nombre: str
    cedula: str
    rol: str
    firma_id: uuid.UUID

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
