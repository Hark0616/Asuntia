"""Validación acotada previa a cualquier escritura en el proveedor."""

from pathlib import Path
from io import BytesIO
import re
import unicodedata
from zipfile import BadZipFile, ZIP_DEFLATED, ZIP_STORED, ZipFile

from fastapi import HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from app.core.document_policy import (
    DOCUMENT_MIME_BY_EXTENSION, MAX_DOCUMENT_BYTES, UPLOAD_CHUNK_BYTES,
)


def validate_filename(filename: str) -> str:
    filename = unicodedata.normalize("NFC", filename)
    if (not filename or len(filename) > 200 or filename != filename.strip()
            or filename.endswith(".") or any(c in filename for c in '<>:"/\\|?*')
            or any(unicodedata.category(c).startswith("C") for c in filename)
            or re.fullmatch(r"(?i:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?", filename)):
        raise HTTPException(422, "El nombre del archivo no es válido.")
    return filename


def detected_mime(content: bytes) -> str | None:
    """Reconoce el contenedor; no equivale a una inspección antivirus."""
    if re.match(rb"%PDF-[12]\.\d(?:\r|\n)", content) and content.rstrip().endswith(b"%%EOF"):
        return "application/pdf"
    if (content.startswith(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR")
            and content.endswith(b"\x00\x00\x00\x00IEND\xaeB`\x82")):
        return "image/png"
    if content.startswith(b"\xff\xd8\xff") and content.endswith(b"\xff\xd9"):
        return "image/jpeg"
    if content.startswith((b"GIF87a", b"GIF89a")) and content.endswith(b";"):
        return "image/gif"
    if (content.startswith(b"RIFF") and content[8:12] == b"WEBP"
            and len(content) >= 20 and int.from_bytes(content[4:8], "little") == len(content) - 8
            and content[12:16] in {b"VP8 ", b"VP8L", b"VP8X"}):
        return "image/webp"
    if content.startswith(b"PK"):
        # Solo inspeccionar el directorio ZIP, sin extraer ni descomprimir el
        # documento. Office siempre se descarga; no se ejecuta en el navegador.
        end = content.rfind(b"PK\x05\x06", max(0, len(content) - 65557))
        if end < 0 or int.from_bytes(content[end + 10:end + 12], "little") > 2000:
            return None
        try:
            with ZipFile(BytesIO(content)) as archive:
                entries = archive.infolist()
                names = {entry.filename for entry in entries}
                if (len(entries) > 2000 or len(names) != len(entries)
                        or sum(entry.file_size for entry in entries) > 100 * 1024 * 1024
                        or not {"[Content_Types].xml", "_rels/.rels"}.issubset(names)):
                    return None
                for entry in entries:
                    path = entry.filename.replace("\\", "/").lower()
                    if (path.startswith("/") or ".." in path.split("/") or ":" in path
                            or entry.flag_bits & 1 or entry.compress_type not in {ZIP_STORED, ZIP_DEFLATED}
                            or any(part in path for part in ("vbaproject", "activex/", "embeddings/"))):
                        return None
                if "word/document.xml" in names and "xl/workbook.xml" not in names:
                    return DOCUMENT_MIME_BY_EXTENSION[".docx"]
                if "xl/workbook.xml" in names and "word/document.xml" not in names:
                    return DOCUMENT_MIME_BY_EXTENSION[".xlsx"]
        except (BadZipFile, ValueError, OSError, NotImplementedError):
            return None
        return None
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        return None
    if text and all(c in "\r\n\t" or not unicodedata.category(c).startswith("C") for c in text):
        return "text/plain"
    return None


async def read_validated_upload(file: UploadFile) -> tuple[bytes, str, str]:
    """Nunca lee más de un bloque adicional al máximo y siempre cierra el spool."""
    try:
        filename = validate_filename(file.filename or "")
        expected = DOCUMENT_MIME_BY_EXTENSION.get(Path(filename).suffix.lower())
        if not expected:
            raise HTTPException(415, "Formato admitido: PDF, imágenes, TXT, DOCX o XLSX.")
        declared = (file.content_type or "application/octet-stream").split(";", 1)[0].strip().lower()
        if declared not in {expected, "application/octet-stream"}:
            raise HTTPException(415, "El tipo declarado no corresponde al archivo.")
        if file.size is not None and file.size > MAX_DOCUMENT_BYTES:
            raise HTTPException(413, "El archivo supera el límite de 20 MiB.")
        content = bytearray()
        while chunk := await file.read(min(UPLOAD_CHUNK_BYTES, MAX_DOCUMENT_BYTES + 1 - len(content))):
            content.extend(chunk)
            if len(content) > MAX_DOCUMENT_BYTES:
                raise HTTPException(413, "El archivo supera el límite de 20 MiB.")
        if not content:
            raise HTTPException(422, "El archivo está vacío.")
        content = bytes(content)
        if await run_in_threadpool(detected_mime, content) != expected:
            raise HTTPException(415, "El contenido no corresponde al formato del archivo.")
        return content, filename, expected
    finally:
        await file.close()
