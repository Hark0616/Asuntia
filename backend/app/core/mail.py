import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

def send_otp_email(email_to: str, otp_code: str) -> bool:
    """
    Envía un código OTP por correo electrónico.
    En local se conecta a Mailpit (localhost:1025).
    """
    message = MIMEMultipart()
    message["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
    message["To"] = email_to
    message["Subject"] = f"{otp_code} es tu código de acceso a Asuntia"

    body = f"""
    Hola,

    Tu código de acceso temporal a Asuntia es: {otp_code}

    Este código vencerá en 15 minutos. Si no solicitaste este código, puedes ignorar este mensaje.

    Atentamente,
    Equipo de Asuntia Legal
    """
    message.attach(MIMEText(body, "plain"))

    try:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(message)
        server.quit()
        return True
    except Exception as e:
        print(f"Error al enviar correo OTP a {email_to}: {e}")
        return False
