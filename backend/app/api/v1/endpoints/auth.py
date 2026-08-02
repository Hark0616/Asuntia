from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import get_current_user
from app.core.db import get_db
from app.schemas.auth import OTPRequest, OTPVerify, LoginRequest, SessionResponse, UserResponse
from app.core.mail import send_otp_email
from app.core.security import create_access_token
from app.models.user import User
from app.services.auth_service import AuthService

router = APIRouter()


def _set_session_cookie(response: Response, access_token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
        domain=settings.COOKIE_DOMAIN,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


def _session_response(user: User, response: Response) -> SessionResponse:
    token_data = {
        "sub": str(user.id),
        "cedula": user.cedula,
        "rol": user.rol,
        "firma_id": str(user.firma_id),
    }
    access_token = create_access_token(data=token_data)
    _set_session_cookie(response, access_token)
    return SessionResponse(user=UserResponse.model_validate(user))


@router.post("/login", response_model=SessionResponse)
async def login_office(
    payload: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user = await AuthService(db).authenticate_office(
        payload.firma_slug, str(payload.email), payload.password
    )
    return _session_response(user, response)

@router.post("/otp/request", status_code=status.HTTP_200_OK)
async def request_otp(payload: OTPRequest, db: AsyncSession = Depends(get_db)):
    """
    Solicita un código OTP por correo electrónico usando la cédula del cliente.
    """
    user, otp_code, destination_email = await AuthService(db).issue_client_otp(
        payload.firma_slug, payload.cedula
    )
    
    # Intentar enviar correo vía Mailpit / SMTP de forma segura sin romper la API
    if user and otp_code and destination_email:
        try:
            send_otp_email(destination_email, otp_code)
        except Exception as err:
            print(f"[OTP Dev Warning] No se pudo contactar servidor SMTP: {err}")
    
    return {"message": "Si la cédula está registrada, recibirás un código de acceso"}

@router.post("/otp/verify", response_model=SessionResponse)
async def verify_otp(payload: OTPVerify, response: Response, db: AsyncSession = Depends(get_db)):
    """
    Verifica el código OTP e inicia sesión del cliente guardando el JWT en cookie HttpOnly.
    """
    user = await AuthService(db).verify_client_otp(
        payload.firma_slug, payload.cedula, payload.code.strip()
    )
    return _session_response(user, response)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response):
    response.delete_cookie(
        key="access_token",
        httponly=True,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
        domain=settings.COOKIE_DOMAIN,
    )
    return None
