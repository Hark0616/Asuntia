"""Límites compartidos por el transporte HTTP y la incorporación documental."""

MAX_DOCUMENT_BYTES = 20 * 1024 * 1024
# El sobre multipart dispone de 1 MiB para campos, cabeceras y separadores.
MAX_UPLOAD_REQUEST_BYTES = MAX_DOCUMENT_BYTES + 1024 * 1024
UPLOAD_CHUNK_BYTES = 64 * 1024

DOCUMENT_MIME_BY_EXTENSION = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".txt": "text/plain",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

# PDF admite acciones, formularios y adjuntos. Hasta disponer de inspección en
# un worker, se descarga como adjunto y no se ejecuta en un iframe de la app.
INLINE_DOCUMENT_TYPES = {
    "image/png", "image/jpeg", "image/gif", "image/webp", "text/plain",
}

DOCUMENT_FOLDER_BY_TYPE = {
    "anexo": "anexo",
    "poder": "anexo",
    "escrito_solicitud": "solicitud",
    "auto_admisorio": "audiencia",
    "acta_audiencia": "audiencia",
    "acta_acuerdo": "audiencia",
    "comunicacion_juzgado": "liquidacion",
    "otro": "anexo",
}


def folder_for_document_type(tipo_documental: str) -> str:
    return DOCUMENT_FOLDER_BY_TYPE.get(tipo_documental, "anexo")
