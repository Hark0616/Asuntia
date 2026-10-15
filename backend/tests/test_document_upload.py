from io import BytesIO
from base64 import b64decode
from pathlib import Path
from unittest.mock import AsyncMock
import uuid
from zipfile import ZipFile

from fastapi import FastAPI, File, UploadFile
from httpx import ASGITransport, AsyncClient
import pytest

from app.config import settings
from app.main import app
from app.core import upload_limit
from app.core.document_policy import MAX_DOCUMENT_BYTES, UPLOAD_CHUNK_BYTES
from app.core.document_policy import DOCUMENT_MIME_BY_EXTENSION
from app.core.upload_limit import UploadLimitMiddleware
from app.services.document_upload import read_validated_upload
from app.services.storage.local_storage import LocalStorageService


CASE_ID = "00000000-0000-0000-0000-000000000201"
UPLOAD = f"/api/v1/asuntos/{CASE_ID}/documentos/upload"
PDF = b"%PDF-1.4\n% Synthetic attachment\n%%EOF"


@pytest.mark.parametrize("filename,content,mime,status", [
    ("vacio.pdf", b"", "application/pdf", 422),
    ("falso.pdf", b"<html>Texto</html>", "application/pdf", 415),
    ("incompleto.pdf", b"%PDF-1.4\ntruncated", "application/pdf", 415),
    ("falso.png", PDF, "image/png", 415),
    ("soporte.pdf", PDF, "image/jpeg", 415),
    ("binario.txt", b"\x00\xff", "text/plain", 415),
    ("macro.docm", b"PK", "application/octet-stream", 415),
    ("pagina.html", b"<script>1</script>", "text/html", 415),
    ("../escape.pdf", PDF, "application/pdf", 422),
    ("carpeta/escape.pdf", PDF, "application/pdf", 422),
    ("NUL.pdf", PDF, "application/pdf", 422),
    ("archivo\u202egpj.pdf", PDF, "application/pdf", 422),
    ("archivo.pdf.", PDF, "application/pdf", 422),
])
async def test_invalid_upload_has_no_document_event_or_storage_write(
    client, isolated_storage_root, filename, content, mime, status
):
    before = await client.get(f"/api/v1/asuntos/{CASE_ID}/documentos")
    files_before = set(isolated_storage_root.rglob("*"))
    response = await client.post(UPLOAD, data={"nombre_funcional": "Entrada rechazada"},
                                 files={"file": (filename, content, mime)})
    assert response.status_code == status, response.text
    after = await client.get(f"/api/v1/asuntos/{CASE_ID}/documentos")
    assert after.json() == before.json()
    assert set(isolated_storage_root.rglob("*")) == files_before


@pytest.mark.parametrize("data", [
    {"nombre_funcional": " "},
    {"nombre_funcional": "a" * 256},
    {"nombre_funcional": "Soporte", "tipo_documental": "inventado"},
    {"nombre_funcional": "Soporte", "compartido_con_cliente": "inventado"},
])
async def test_upload_validates_form_before_writing(client, data):
    response = await client.post(UPLOAD, data=data,
                                 files={"file": ("soporte.pdf", PDF, "application/pdf")})
    assert response.status_code == 422


async def test_upload_canonicalizes_mime_uses_opaque_filename_and_private_download(client):
    response = await client.post(UPLOAD, data={"nombre_funcional": "Soporte único"},
                                 files={"file": ("nombre-identificable.PDF", PDF, "application/octet-stream")})
    assert response.status_code == 201, response.text
    document = response.json()
    assert document["mime_type"] == "application/pdf"
    assert document["compartido_con_cliente"] is False
    path = Path(document["external_file_id"])
    assert path.is_relative_to(Path(settings.LOCAL_STORAGE_PATH))
    assert "nombre-identificable" not in str(path)
    assert len(path.stem) == 32
    assert document["web_view_url"] == f"/api/v1/documentos/{document['id']}/preview"
    preview = await client.get(document["web_view_url"])
    assert preview.content == PDF
    assert preview.headers["content-disposition"].startswith("attachment;")
    assert preview.headers["cache-control"] == "private, no-store"
    assert preview.headers["content-security-policy"].startswith("sandbox; default-src 'none';")
    assert preview.headers["referrer-policy"] == "no-referrer"


async def test_real_png_remains_available_for_restricted_inline_preview(client):
    png = b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6S8AAAAASUVORK5CYII=")
    uploaded = await client.post(UPLOAD, data={"nombre_funcional": "Imagen válida"},
                                 files={"file": ("imagen.png", png, "image/png")})
    assert uploaded.status_code == 201, uploaded.text
    preview = await client.get(uploaded.json()["web_view_url"])
    assert preview.status_code == 200
    assert preview.headers["content-type"] == "image/png"
    assert preview.headers["content-disposition"].startswith("inline;")
    assert preview.content == png


def office_container(path, extra=None):
    output = BytesIO()
    with ZipFile(output, "w") as archive:
        for filename in ["[Content_Types].xml", "_rels/.rels", path, *(extra or [])]:
            archive.writestr(filename, b'<?xml version="1.0"?><test/>')
    return output.getvalue()


@pytest.mark.parametrize("extension,path", [(".docx", "word/document.xml"), (".xlsx", "xl/workbook.xml")])
async def test_office_container_is_downloadable_without_inline_execution(client, extension, path):
    content = office_container(path)
    uploaded = await client.post(UPLOAD, data={"nombre_funcional": "Documento Office"},
                                 files={"file": (f"documento{extension}", content, "application/octet-stream")})
    assert uploaded.status_code == 201, uploaded.text
    assert uploaded.json()["mime_type"] == DOCUMENT_MIME_BY_EXTENSION[extension]
    preview = await client.get(uploaded.json()["web_view_url"])
    assert preview.content == content
    assert preview.headers["content-disposition"].startswith("attachment;")


@pytest.mark.parametrize("extra", [["word/vbaProject.bin"], ["word/activeX/control.xml"],
                                    ["word/embeddings/object.bin"], ["../escape.xml"]])
async def test_office_rejects_macros_embedded_objects_and_unsafe_entries(client, extra):
    response = await client.post(UPLOAD, data={"nombre_funcional": "Office rechazado"}, files={
        "file": ("documento.docx", office_container("word/document.xml", extra), DOCUMENT_MIME_BY_EXTENSION[".docx"]),
    })
    assert response.status_code == 415


async def test_read_limits_unknown_size_and_always_closes_spool(monkeypatch):
    monkeypatch.setattr("app.services.document_upload.MAX_DOCUMENT_BYTES", 100)
    upload = UploadFile(BytesIO(b"x" * 101), filename="soporte.txt")
    original_read = upload.read
    read_sizes = []

    async def bounded_read(size):
        read_sizes.append(size)
        return await original_read(size)

    upload.read = bounded_read
    with pytest.raises(Exception) as caught:
        await read_validated_upload(upload)
    assert caught.value.status_code == 413
    assert read_sizes and max(read_sizes) <= UPLOAD_CHUNK_BYTES
    assert upload.file.closed


async def test_read_interruption_closes_file_without_storage_write():
    upload = UploadFile(BytesIO(PDF), filename="soporte.pdf")
    upload.read = AsyncMock(side_effect=OSError("interrupted"))
    with pytest.raises(OSError):
        await read_validated_upload(upload)
    assert upload.file.closed


async def test_exact_file_limit_is_accepted_and_one_extra_byte_is_rejected(client, monkeypatch):
    monkeypatch.setattr("app.services.document_upload.MAX_DOCUMENT_BYTES", 40)
    for size, status in [(40, 201), (41, 413)]:
        response = await client.post(UPLOAD, data={"nombre_funcional": "Texto acotado"},
                                     files={"file": ("texto.txt", b"a" * size, "text/plain")})
        assert response.status_code == status, response.text


async def test_http_limit_rejects_declared_excess_before_parsing_and_preserves_cors(client):
    response = await client.post(UPLOAD, content=b"x", headers={
        "Content-Length": str(MAX_DOCUMENT_BYTES + 1024 * 1024 + 1),
        "Origin": "http://127.0.0.1:5173",
    })
    assert response.status_code == 413
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"


async def test_upload_requires_office_session_and_existing_accessible_case(client, carlos_client):
    files = {"file": ("soporte.pdf", PDF, "application/pdf")}
    data = {"nombre_funcional": "Soporte"}
    assert (await carlos_client.post(UPLOAD, files=files, data=data)).status_code == 403
    assert (await client.post(f"/api/v1/asuntos/{uuid.uuid4()}/documentos/upload",
                              files=files, data=data)).status_code == 404
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as anonymous:
        assert (await anonymous.post(UPLOAD, files=files, data=data)).status_code == 401


async def test_disconnected_multipart_closes_partial_spool(monkeypatch):
    import starlette.formparsers as parsers

    original_spool = parsers.SpooledTemporaryFile
    opened = []

    def tracked_spool(*args, **kwargs):
        spool = original_spool(*args, **kwargs)
        opened.append(spool)
        return spool

    monkeypatch.setattr(parsers, "SpooledTemporaryFile", tracked_spool)
    application = FastAPI()
    application.add_middleware(UploadLimitMiddleware)

    @application.post("/api/v1/asuntos/test/documentos/upload")
    async def endpoint(file: UploadFile = File(...)):
        pytest.fail("Una carga interrumpida no llega al controlador")

    messages = iter([
        {"type": "http.request", "more_body": True, "body":
         b'--boundary\r\nContent-Disposition: form-data; name="file"; filename="a.txt"\r\n\r\npartial'},
        {"type": "http.disconnect"},
    ])
    output = []

    async def receive():
        return next(messages)

    async def send(message):
        output.append(message)

    await application({"type": "http", "method": "POST", "scheme": "http", "path":
                       "/api/v1/asuntos/test/documentos/upload", "query_string": b"",
                       "headers": [(b"content-type", b"multipart/form-data; boundary=boundary")]}, receive, send)
    assert output[0]["status"] == 400
    assert opened and all(spool.closed for spool in opened)


@pytest.mark.parametrize("declared_length", [None, "1"])
async def test_transport_counts_real_stream_even_without_or_with_false_length(monkeypatch, declared_length):
    monkeypatch.setattr(upload_limit, "MAX_UPLOAD_REQUEST_BYTES", 4096)
    application = FastAPI()
    application.add_middleware(UploadLimitMiddleware)
    reached = []

    @application.post("/api/v1/asuntos/test/documentos/upload")
    async def endpoint(file: UploadFile = File(...)):
        reached.append(True)
        return {"size": len(await file.read())}

    async def body():
        yield b'--boundary\r\nContent-Disposition: form-data; name="file"; filename="a.txt"\r\n\r\n'
        for _ in range(10):
            yield b"a" * 1024
        yield b"\r\n--boundary--\r\n"

    headers = {"Content-Type": "multipart/form-data; boundary=boundary"}
    if declared_length:
        headers["Content-Length"] = declared_length
    async with AsyncClient(transport=ASGITransport(app=application), base_url="http://test") as http:
        response = await http.post("/api/v1/asuntos/test/documentos/upload", content=body(), headers=headers)
    assert response.status_code == 413, response.text
    assert reached == []


@pytest.mark.parametrize("parent", ["../outside", "C:/Windows", "anexo/../../outside"])
async def test_local_storage_refuses_outside_parent(tmp_path, parent):
    storage = LocalStorageService(str(tmp_path))
    with pytest.raises(ValueError):
        await storage.upload_file(PDF, "soporte.pdf", "application/pdf", parent)
    assert not list(tmp_path.rglob("*"))


async def test_local_missing_file_raises_instead_of_inventing_metadata(tmp_path):
    with pytest.raises(FileNotFoundError):
        await LocalStorageService(str(tmp_path)).get_file_metadata("missing.pdf")


async def test_failed_local_rename_leaves_no_partial_or_available_file(tmp_path, monkeypatch):
    def fail(*args):
        raise OSError("synthetic storage failure")

    monkeypatch.setattr("app.services.storage.local_storage.os.replace", fail)
    with pytest.raises(OSError):
        await LocalStorageService(str(tmp_path)).upload_file(PDF, "soporte.pdf", "application/pdf")
    assert list(tmp_path.iterdir()) == []
