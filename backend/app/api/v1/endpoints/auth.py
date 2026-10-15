from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import access_token_cookie, get_current_user
from app.core.db import get_db
from app.schemas.auth import (OTPRequest, OTPVerify, LoginRequest, SessionResponse, UserResponse,
    AccessRequestResponse, PasswordResetRequest, PasswordResetConfirm)
from app.core.mail import send_otp_email, send_password_reset_email, send_password_changed_email
from app.core.auth_response import uniform_auth_response
from app.core.security import create_access_token
from app.models.user import User
from app.services.auth_service import AuthService
from app.services.equipo_service import EquipoService
from app.schemas.equipo import ActivarEquipoRequest
from app.repositories.firma_repository import FirmaRepository
from app.core.exceptions import DomainException
from app.services.auth_rate_limit_service import AuthRateLimiter

router = APIRouter()


@router.post("/equipo/activar", status_code=204)
async def activate_team_member(payload: ActivarEquipoRequest, response: Response, request: Request,
                               db: AsyncSession = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    firma = await FirmaRepository(db).get_by_subdominio(payload.firma_slug)
    if not firma:
        raise DomainException(detail="Invitación inválida o vencida")
    await AuthRateLimiter(db, firma.id).check("team-activation", str(payload.invitacion_id),
        request.client.host if request.client else "unknown", settings.AUTH_VERIFY_LIMIT)
    await EquipoService(db, firma.id).activate(payload)


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


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key="access_token", httponly=True, samesite="lax",
        secure=settings.ENVIRONMENT == "production", domain=settings.COOKIE_DOMAIN)


def _session_response(user: User, response: Response) -> SessionResponse:
    token_data = {
        "sub": str(user.id),
        "cedula": user.cedula,
        "rol": user.rol,
        "firma_id": str(user.firma_id),
        "user_revision": user.updated_at.isoformat(),
    }
    access_token = create_access_token(data=token_data)
    _set_session_cookie(response, access_token)
    return SessionResponse(user=UserResponse.model_validate(user))


@router.post("/login", response_model=SessionResponse)
async def login_office(
    payload: LoginRequest,
    response: Response,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    async with uniform_auth_response():
        user = await AuthService(db).authenticate_office(
            payload.firma_slug, str(payload.email), payload.password,
            request.client.host if request.client else "unknown")
    return _session_response(user, response)

@router.post("/otp/request", response_model=AccessRequestResponse)
async def request_otp(payload: OTPRequest, request: Request, response: Response,
                      background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """
    Solicita un código OTP por correo electrónico usando la cédula del cliente.
    """
    response.headers["Cache-Control"] = "no-store"
    async with uniform_auth_response():
        user, otp_code, destination_email = await AuthService(db).issue_client_otp(
            payload.firma_slug, payload.cedula, request.client.host if request.client else "unknown")
        # El correo individual sale después de la respuesta y fuera del event loop.
        if user and otp_code and destination_email:
            background_tasks.add_task(send_otp_email, destination_email, otp_code)
    return {"message": "Si los datos coinciden, enviaremos un código de acceso",
            "expires_in_seconds": settings.OTP_TTL_MINUTES * 60}

@router.post("/otp/verify", response_model=SessionResponse)
async def verify_otp(payload: OTPVerify, response: Response, request: Request, db: AsyncSession = Depends(get_db)):
    """
    Verifica el código OTP e inicia sesión del cliente guardando el JWT en cookie HttpOnly.
    """
    user = await AuthService(db).verify_client_otp(
        payload.firma_slug, payload.cedula, payload.code.strip(),
        request.client.host if request.client else "unknown",
    )
    return _session_response(user, response)


@router.post("/password/request", response_model=AccessRequestResponse)
async def request_password_reset(payload: PasswordResetRequest, request: Request, response: Response,
                                  background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    async with uniform_auth_response():
        delivery = await AuthService(db).issue_password_reset(payload.firma_slug, str(payload.email),
            request.client.host if request.client else "unknown")
        if delivery:
            background_tasks.add_task(send_password_reset_email, *delivery)
    return {"message": "Si los datos coinciden, enviaremos un enlace de recuperación",
            "expires_in_seconds": settings.PASSWORD_RESET_TTL_MINUTES * 60}


@router.post("/password/confirm", status_code=204)
async def confirm_password_reset(payload: PasswordResetConfirm, request: Request, response: Response,
                                 background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    email = await AuthService(db).reset_password(payload, request.client.host if request.client else "unknown")
    _clear_session_cookie(response)
    background_tasks.add_task(send_password_changed_email, email)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response, access_token: str | None = Depends(access_token_cookie),
                 db: AsyncSession = Depends(get_db)):
    await AuthService(db).revoke_sessions(access_token)
    _clear_session_cookie(response)
    return None
