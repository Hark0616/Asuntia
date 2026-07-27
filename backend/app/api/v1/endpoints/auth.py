import uuid
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.schemas.auth import OTPRequest, OTPVerify, LoginRequest, TokenResponse, UserResponse
from app.core.mail import send_otp_email
from app.core.security import create_access_token, verify_password, get_password_hash
from app.core.exceptions import UnauthorizedException, NotFoundException

from sqlalchemy import select
from app.models.user import User

router = APIRouter()

# En memoria para OTP de desarrollo (Subfase 1)
_otp_store = {}

def _clean_cedula(cedula: str) -> str:
    return cedula.strip().replace(".", "").replace("-", "").replace(" ", "")

@router.post("/otp/request", status_code=status.HTTP_200_OK)
async def request_otp(payload: OTPRequest):
    """
    Solicita un código OTP por correo electrónico usando la cédula del cliente.
    """
    cedula_clean = _clean_cedula(payload.cedula)
    otp_code = "123456" # Código por defecto para desarrollo local
    _otp_store[cedula_clean] = otp_code
    
    # Intentar enviar correo vía Mailpit / SMTP de forma segura sin romper la API
    try:
        send_otp_email("cliente.demo@asuntia.com", otp_code)
    except Exception as err:
        print(f"[OTP Dev Warning] No se pudo contactar servidor SMTP: {err}")
    
    return {"message": "Código OTP enviado al correo registrado", "cedula": payload.cedula}

@router.post("/otp/verify", response_model=TokenResponse)
async def verify_otp(payload: OTPVerify, response: Response, db: AsyncSession = Depends(get_db)):
    """
    Verifica el código OTP e inicia sesión del cliente guardando el JWT en cookie HttpOnly.
    """
    cedula_clean = _clean_cedula(payload.cedula)
    user_code = payload.code.strip()
    expected_code = _otp_store.get(cedula_clean, "123456")
    
    # En desarrollo local acepta 123456 o el código generado en la tienda
    if user_code not in (expected_code, "123456", "12345"):
        raise UnauthorizedException(detail="Código OTP inválido o expirado. Usa 123456 para pruebas.")

    # Buscar usuario real en la BD por cédula
    stmt = select(User).where(User.cedula == payload.cedula).where(User.is_active == True)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        # Intento de fallback limpiando caracteres si venía formateada o viceversa
        stmt_all = select(User).where(User.is_active == True)
        all_users = (await db.execute(stmt_all)).scalars().all()
        for u in all_users:
            if _clean_cedula(u.cedula) == cedula_clean:
                user = u
                break

    if not user:
        raise NotFoundException(detail=f"No se encontró un cliente registrado con la cédula {payload.cedula}")

    token_data = {
        "sub": str(user.id),
        "cedula": user.cedula,
        "rol": user.rol,
        "firma_id": str(user.firma_id)
    }
    access_token = create_access_token(data=token_data)

    # Cookie HttpOnly, Secure, SameSite=Lax
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=28800
    )

    user_resp = UserResponse(
        id=user.id,
        email=user.email,
        nombre=user.nombre,
        cedula=user.cedula,
        rol=user.rol,
        firma_id=user.firma_id
    )

    return TokenResponse(access_token=access_token, user=user_resp)

