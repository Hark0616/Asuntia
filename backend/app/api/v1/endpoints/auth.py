from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.schemas.auth import OTPRequest, OTPVerify, LoginRequest, TokenResponse, UserResponse
from app.core.mail import send_otp_email
from app.core.security import create_access_token, verify_password, get_password_hash
from app.core.exceptions import UnauthorizedException, NotFoundException

router = APIRouter()

# En memoria para OTP de desarrollo (Subfase 1)
_otp_store = {}

@router.post("/otp/request", status_code=status.HTTP_200_OK)
async def request_otp(payload: OTPRequest):
    """
    Solicita un código OTP por correo electrónico usando la cédula del cliente.
    """
    otp_code = "123456" # Código fijo para desarrollo local de la Subfase 1
    _otp_store[payload.cedula] = otp_code
    
    # Enviar correo vía Mailpit / SMTP
    send_otp_email("cliente.demo@asuntia.com", otp_code)
    
    return {"message": "Código OTP enviado al correo registrado", "cedula": payload.cedula}

@router.post("/otp/verify", response_model=TokenResponse)
async def verify_otp(payload: OTPVerify, response: Response):
    """
    Verifica el código OTP e inicia sesión del cliente guardando el JWT en cookie HttpOnly.
    """
    expected_code = _otp_store.get(payload.cedula, "123456")
    if payload.code != expected_code:
        raise UnauthorizedException(detail="Código OTP inválido o expirado")

    # Mock user cliente para Subfase 1
    token_data = {
        "sub": "user-cliente-demo-id",
        "cedula": payload.cedula,
        "rol": "cliente",
        "firma_id": "00000000-0000-0000-0000-000000000001"
    }
    access_token = create_access_token(data=token_data)

    # Cookie HttpOnly, Secure, SameSite=Lax
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=False, # True en producción HTTPS
        max_age=28800
    )

    user_resp = UserResponse(
        id="user-cliente-demo-id",
        email="carlos.gomez@email.com",
        nombre="Carlos Gómez Restrepo",
        cedula=payload.cedula,
        rol="cliente",
        firma_id="00000000-0000-0000-0000-000000000001"
    )

    return TokenResponse(access_token=access_token, user=user_resp)
