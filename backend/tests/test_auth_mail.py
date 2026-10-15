import asyncio
import logging
import smtplib
from email import policy
from email.parser import BytesParser

import pytest
from pydantic import ValidationError

from app.config import Settings, settings
from app.core import mail


async def test_real_local_smtp_delivery_does_not_block_event_loop(monkeypatch):
    delivered = asyncio.get_running_loop().create_future()

    async def smtp_capture(reader, writer):
        writer.write(b"220 capture ESMTP\r\n")
        await writer.drain()
        try:
            while line := await reader.readline():
                command = line.decode().strip().upper()
                if command.startswith("EHLO"):
                    writer.write(b"250-capture\r\n250 8BITMIME\r\n")
                elif command == "DATA":
                    writer.write(b"354 End with dot\r\n")
                    await writer.drain()
                    raw = await reader.readuntil(b"\r\n.\r\n")
                    delivered.set_result(BytesParser(policy=policy.default).parsebytes(raw[:-3]))
                    writer.write(b"250 Received\r\n")
                elif command == "QUIT":
                    writer.write(b"221 Goodbye\r\n")
                    await writer.drain()
                    break
                else:
                    writer.write(b"250 OK\r\n")
                await writer.drain()
        finally:
            writer.close()
            await writer.wait_closed()

    server = await asyncio.start_server(smtp_capture, "127.0.0.1", 0)
    monkeypatch.setattr(settings, "SMTP_HOST", "127.0.0.1")
    monkeypatch.setattr(settings, "SMTP_PORT", server.sockets[0].getsockname()[1])
    monkeypatch.setattr(settings, "SMTP_SECURITY", "none")
    monkeypatch.setattr(settings, "SMTP_USER", "")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "")
    monkeypatch.setattr(settings, "OTP_TTL_MINUTES", 7)
    try:
        assert await asyncio.wait_for(mail.send_otp_email("test@example.com", "123456"), timeout=5)
        message = await asyncio.wait_for(delivered, timeout=1)
        assert message["To"] == "test@example.com"
        assert "123456" not in message["Subject"]
        assert "Vence en 7 minutos" in message.get_content()
        assert "123456" in message.get_content()
    finally:
        server.close()
        await server.wait_closed()


async def test_delivery_failures_are_bounded_and_logs_have_no_secrets(monkeypatch, caplog):
    calls = []

    def fail(message):
        calls.append(message)
        raise smtplib.SMTPException("private-link-and-address")

    monkeypatch.setattr(mail, "_send_message", fail)
    monkeypatch.setattr(settings, "SMTP_MAX_ATTEMPTS", 2)
    with caplog.at_level(logging.INFO, logger="app.core.mail"):
        result = await mail.send_password_reset_email("private@example.com", "https://safe.example/#private-token")
    assert not result
    assert len(calls) == 2
    assert "auth_mail_delivery_failed purpose=password_reset" in caplog.text
    assert "private" not in caplog.text


def test_starttls_precedes_login_and_timeout_is_explicit(monkeypatch):
    calls = []

    class SMTP:
        def __init__(self, **kwargs):
            assert kwargs["timeout"] == settings.SMTP_TIMEOUT_SECONDS

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def starttls(self, *, context):
            assert context.check_hostname
            calls.append("tls")

        def login(self, user, password):
            calls.append("login")

        def send_message(self, message):
            calls.append("send")

    monkeypatch.setattr(mail.smtplib, "SMTP", SMTP)
    monkeypatch.setattr(settings, "SMTP_SECURITY", "starttls")
    monkeypatch.setattr(settings, "SMTP_USER", "user")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "test-only")
    mail._send_message(mail.EmailMessage())
    assert calls == ["tls", "login", "send"]


@pytest.mark.parametrize("change", [
    {"SMTP_SECURITY": "none"}, {"FRONTEND_URL": "http://app.example.com"},
    {"FRONTEND_URL": "https://user:secret@app.example.com"}, {"FRONTEND_URL": "javascript:alert(1)"},
    {"AUTH_LOGIN_LIMIT": 0}, {"OTP_TTL_MINUTES": 0},
])
def test_unsafe_auth_settings_are_rejected(change):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **{ "ENVIRONMENT": "production", "JWT_SECRET": "test-secret-non-default",
            "STORAGE_TOKEN_ENCRYPTION_KEY": "test-only", "SMTP_SECURITY": "starttls",
            "FRONTEND_URL": "https://app.example.com", **change })
