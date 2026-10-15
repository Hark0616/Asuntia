import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage

from starlette.concurrency import run_in_threadpool

from app.config import settings

logger = logging.getLogger(__name__)


def _send_message(message: EmailMessage) -> None:
    """SMTP transaccional. En local usa Mailpit; producción exige TLS."""
    if settings.ENVIRONMENT == "production" and settings.SMTP_SECURITY == "none":
        raise ValueError("SMTP requiere TLS")
    arguments = dict(host=settings.SMTP_HOST, port=settings.SMTP_PORT,
                     timeout=settings.SMTP_TIMEOUT_SECONDS)
    context = ssl.create_default_context()
    server = (smtplib.SMTP_SSL(**arguments, context=context) if settings.SMTP_SECURITY == "ssl"
              else smtplib.SMTP(**arguments))
    with server:
        if settings.SMTP_SECURITY == "starttls":
            server.starttls(context=context)
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(message)


async def _deliver(email_to: str, subject: str, body: str, purpose: str) -> bool:
    message = EmailMessage()
    message["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
    message["To"] = email_to
    message["Subject"] = subject
    message.set_content(body)
    for attempt in range(settings.SMTP_MAX_ATTEMPTS):
        try:
            await run_in_threadpool(_send_message, message)
            logger.info("auth_mail_delivered purpose=%s", purpose)
            return True
        except (OSError, smtplib.SMTPException, ValueError) as error:
            # Solo categorías operativas: nunca códigos, enlaces, destinatarios o credenciales.
            logger.warning("auth_mail_attempt_failed purpose=%s attempt=%s error=%s",
                           purpose, attempt + 1, type(error).__name__)
            if attempt + 1 < settings.SMTP_MAX_ATTEMPTS:
                await asyncio.sleep(0.25 * (attempt + 1))
    logger.error("auth_mail_delivery_failed purpose=%s", purpose)
    return False


async def send_otp_email(email_to: str, otp_code: str) -> bool:
    """Envía el acceso individual sin bloquear el event loop; Mailpit en local."""
    return await _deliver(email_to, "Código de acceso a Asuntia",
        f"Tu código de acceso a Asuntia es: {otp_code}\n\n"
        f"Vence en {settings.OTP_TTL_MINUTES} minutos. Si no lo solicitaste, ignora este mensaje.", "otp")


async def send_password_reset_email(email_to: str, link: str) -> bool:
    return await _deliver(email_to, "Restablecer acceso a Asuntia",
        f"Para crear una nueva contraseña, abre este enlace:\n\n{link}\n\n"
        f"Vence en {settings.PASSWORD_RESET_TTL_MINUTES} minutos. Si no lo solicitaste, ignora este mensaje.",
        "password_reset")


async def send_password_changed_email(email_to: str) -> bool:
    return await _deliver(email_to, "Contraseña actualizada en Asuntia",
        "Tu contraseña de Asuntia fue actualizada y las sesiones anteriores fueron revocadas.\n\n"
        "Si no realizaste este cambio, contacta al administrador de tu firma.", "password_changed")
