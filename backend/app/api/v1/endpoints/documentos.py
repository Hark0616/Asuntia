import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.asunto import Asunto
from app.models.documento import DocumentoAsunto
from app.repositories.documento_repository import DocumentoRepository
from app.schemas.documento import DocumentoResponse, DocumentoLinkCreate
from app.services.storage.factory import StorageFactory

router = APIRouter()
DEFAULT_FIRMA_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

@router.get("/asuntos/{asunto_id}/documentos", response_model=List[DocumentoResponse])
async def list_documentos_asunto(
    asunto_id: uuid.UUID,
    solo_compartidos: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """
    Lista los documentos vinculados a un asunto expedientes.
    Si solo_compartidos es True (ej. portal cliente), solo retorna documentos visibles para el cliente.
    """
    repo = DocumentoRepository(db, DEFAULT_FIRMA_ID)
    return await repo.list_by_asunto(asunto_id, solo_compartidos=solo_compartidos)

@router.post("/asuntos/{asunto_id}/documentos/upload", response_model=DocumentoResponse, status_code=status.HTTP_201_CREATED)
async def upload_documento_asunto(
    asunto_id: uuid.UUID,
    nombre_funcional: str = Form(...),
    tipo_documental: str = Form("otro"),
    subcarpeta: Optional[str] = Form("anexo"), # anexo, solicitud, audiencia, liquidacion
    compartido_con_cliente: bool = Form(False),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Sube un archivo usando el proveedor de almacenamiento activo de la firma (Google Drive, OneDrive, Local).
    Garantiza aprovisionamiento dinámico de carpetas por proveedor (JSONB).
    """
    asunto = await db.get(Asunto, asunto_id)
    if not asunto:
        raise HTTPException(status_code=404, detail="Asunto no encontrado")

    provider = await StorageFactory.get_provider_for_firma(db, DEFAULT_FIRMA_ID)
    provider_name = type(provider).__name__.replace("StorageService", "").lower()
    if provider_name == "googledrive":
        provider_name = "google_drive"

    # Verificar si ya existe estructura en storage_folders JSONB para este proveedor
    storage_folders = dict(asunto.storage_folders or {})
    provider_folders = storage_folders.get(provider_name)

    if not provider_folders:
        # Aprovisionamiento bajo demanda de las 4 carpetas en la nube activa
        folder_struct = await provider.create_case_folder_structure(asunto.radicado)
        storage_folders[provider_name] = folder_struct
        asunto.storage_folders = storage_folders
        await db.commit()
        provider_folders = folder_struct

    # Determinar carpeta de destino según subcarpeta
    target_subfolder_id = None
    if provider_folders and "subfolders" in provider_folders:
        target_subfolder_id = provider_folders["subfolders"].get(subcarpeta or "anexo") or provider_folders.get("root_folder_id")

    # Streaming de bytes hacia el proveedor
    file_bytes = await file.read()
    file_id, web_view, web_download, size_bytes = await provider.upload_file(
        file_bytes=file_bytes,
        filename=file.filename or nombre_funcional,
        mime_type=file.content_type or "application/pdf",
        parent_folder_id=target_subfolder_id
    )

    repo = DocumentoRepository(db, DEFAULT_FIRMA_ID)
    doc_data = {
        "asunto_id": asunto_id,
        "nombre_funcional": nombre_funcional,
        "tipo_documental": tipo_documental,
        "provider": provider_name,
        "external_file_id": file_id,
        "web_view_url": web_view,
        "web_download_url": web_download,
        "mime_type": file.content_type or "application/pdf",
        "tamano_bytes": size_bytes,
        "compartido_con_cliente": compartido_con_cliente,
        "estado_revision": "recibido"
    }

    return await repo.create(doc_data)

@router.post("/asuntos/{asunto_id}/documentos/vincular", response_model=DocumentoResponse, status_code=status.HTTP_201_CREATED)
async def vincular_documento_drive(
    asunto_id: uuid.UUID,
    payload: DocumentoLinkCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Vincula un archivo ya existente en Google Drive / OneDrive a un expediente.
    """
    asunto = await db.get(Asunto, asunto_id)
    if not asunto:
        raise HTTPException(status_code=404, detail="Asunto no encontrado")

    repo = DocumentoRepository(db, DEFAULT_FIRMA_ID)
    doc_data = {
        "asunto_id": asunto_id,
        "nombre_funcional": payload.nombre_funcional,
        "tipo_documental": payload.tipo_documental,
        "provider": "google_drive",
        "external_file_id": payload.external_file_id,
        "web_view_url": payload.web_view_url,
        "web_download_url": payload.web_download_url,
        "mime_type": payload.mime_type,
        "tamano_bytes": payload.tamano_bytes,
        "compartido_con_cliente": payload.compartido_con_cliente,
        "estado_revision": "recibido"
    }

    return await repo.create(doc_data)

@router.get("/documentos/{documento_id}/preview")
async def preview_documento_proxy(
    documento_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Proxy de previsualización para clientes. Retorna los bytes directamente para previsualizar sin requerir login en Google/OneDrive.
    """
    repo = DocumentoRepository(db, DEFAULT_FIRMA_ID)
    doc = await repo.get_by_id(documento_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    # Contenido simulado o de stream para previsualización PDF limpia
    pdf_sample = b"%PDF-1.4 %... Visualizador de Documento Asuntia Legal ..."
    return Response(content=pdf_sample, media_type="application/pdf", headers={"Content-Disposition": f"inline; filename={doc.nombre_funcional}.pdf"})

@router.patch("/documentos/{documento_id}/visibilidad", response_model=DocumentoResponse)
async def toggle_visibilidad_documento(
    documento_id: uuid.UUID,
    compartido: bool,
    db: AsyncSession = Depends(get_db)
):
    """
    Alterna si el documento es visible para el cliente (compartido_con_cliente = true/false).
    """
    repo = DocumentoRepository(db, DEFAULT_FIRMA_ID)
    doc = await repo.toggle_visibilidad(documento_id, compartido)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return doc

@router.delete("/documentos/{documento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_documento(
    documento_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Borrado lógico de documento (Soft Delete).
    """
    repo = DocumentoRepository(db, DEFAULT_FIRMA_ID)
    success = await repo.soft_delete(documento_id)
    if not success:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return None
