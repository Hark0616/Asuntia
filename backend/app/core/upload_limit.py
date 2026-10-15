"""Acota el cuerpo real antes de que el parser multipart lo almacene en disco."""

from starlette.formparsers import MultiPartException
from starlette.responses import JSONResponse

from app.core.document_policy import MAX_UPLOAD_REQUEST_BYTES


class UploadLimitMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        path = scope.get("path", "").rstrip("/")
        if (scope["type"] != "http" or scope.get("method") != "POST"
                or not path.startswith("/api/v1/asuntos/")
                or not path.endswith("/documentos/upload")):
            return await self.app(scope, receive, send)

        detail = "La carga supera el límite de 21 MiB por solicitud."
        for key, value in scope.get("headers", []):
            if key.lower() == b"content-length":
                try:
                    length = int(value)
                except ValueError:
                    length = -1
                if length < 0:
                    return await JSONResponse({"detail": "Content-Length inválido"}, 400)(scope, receive, send)
                if length > MAX_UPLOAD_REQUEST_BYTES:
                    return await JSONResponse({"detail": detail}, 413)(scope, receive, send)

        received = 0
        exceeded = False

        async def limited_receive():
            nonlocal received, exceeded
            message = await receive()
            if message["type"] == "http.disconnect":
                # MultiPartParser cierra sus archivos temporales en esta salida.
                raise MultiPartException("La carga fue interrumpida.")
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > MAX_UPLOAD_REQUEST_BYTES:
                    exceeded = True
                    raise MultiPartException(detail)
            return message

        async def limited_send(message):
            if exceeded and message["type"] == "http.response.start":
                message = {**message, "status": 413}
            await send(message)

        return await self.app(scope, limited_receive, limited_send)
