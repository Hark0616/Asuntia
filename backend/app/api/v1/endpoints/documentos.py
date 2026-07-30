import uuid
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_office_user
from app.core.db import get_db
from app.models.user import User
from app.repositories.asunto_repository import AsuntoRepository
from app.repositories.documento_repository import DocumentoRepository
from app.repositories.novedad_repository import NovedadRepository
from app.schemas.documento import DocumentoResponse, DocumentoLinkCreate
from app.services.storage.factory import StorageFactory

router = APIRouter()

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


@router.get("/asuntos/{asunto_id}/documentos", response_model=List[DocumentoResponse])
async def list_documentos_asunto(
    asunto_id: uuid.UUID,
    solo_compartidos: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista los documentos vinculados a un asunto expedientes.
    Si solo_compartidos es True (ej. portal cliente), solo retorna documentos visibles para el cliente.
    """
    asunto = await AsuntoRepository(db, current_user.firma_id).get_by_id(asunto_id)
    if not asunto or (
        current_user.rol == "cliente" and asunto.cliente_id != current_user.id
    ):
        raise HTTPException(status_code=404, detail="Asunto no encontrado")
    if current_user.rol == "cliente":
        solo_compartidos = True
    repo = DocumentoRepository(db, current_user.firma_id)
    return await repo.list_by_asunto(asunto_id, solo_compartidos=solo_compartidos)

@router.post("/asuntos/{asunto_id}/documentos/upload", response_model=DocumentoResponse, status_code=status.HTTP_201_CREATED)
async def upload_documento_asunto(
    asunto_id: uuid.UUID,
    nombre_funcional: str = Form(...),
    tipo_documental: str = Form("otro"),
    subcarpeta: Optional[str] = Form(None),
    compartido_con_cliente: bool = Form(False),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_office_user),
):
    """
    Sube un archivo usando el proveedor de almacenamiento activo de la firma (Google Drive, OneDrive, Local).
    Garantiza aprovisionamiento dinámico de carpetas por proveedor (JSONB).
    """
    asunto_repo = AsuntoRepository(db, current_user.firma_id)
    asunto = await asunto_repo.get_by_id(asunto_id)
    if not asunto:
        raise HTTPException(status_code=404, detail="Asunto no encontrado")

    provider = await StorageFactory.get_provider_for_firma(db, current_user.firma_id)
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
        await asunto_repo.update(asunto, {"storage_folders": storage_folders})
        provider_folders = folder_struct

    # La carpeta se deriva del tipo documental para conservar una sola
    # clasificación canónica. El parámetro legado se acepta, pero no decide.
    target_folder = folder_for_document_type(tipo_documental)
    target_subfolder_id = None
    if provider_folders and "subfolders" in provider_folders:
        target_subfolder_id = provider_folders["subfolders"].get(target_folder) or provider_folders.get("root_folder_id")

    # Streaming de bytes hacia el proveedor
    file_bytes = await file.read()
    file_id, web_view, web_download, size_bytes = await provider.upload_file(
        file_bytes=file_bytes,
        filename=file.filename or nombre_funcional,
        mime_type=file.content_type or "application/pdf",
        parent_folder_id=target_subfolder_id
    )

    repo = DocumentoRepository(db, current_user.firma_id)
    active_step = next(
        (step for step in asunto.pasos if step.estado == "activo" and step.is_active),
        None,
    )
    doc_data = {
        "asunto_id": asunto_id,
        "asunto_paso_id": active_step.id if active_step else None,
        "nombre_funcional": nombre_funcional,
        "tipo_documental": tipo_documental,
        "subcarpeta": target_folder,
        "provider": provider_name,
        "external_file_id": file_id,
        "web_view_url": web_view,
        "web_download_url": web_download,
        "mime_type": file.content_type or "application/pdf",
        "tamano_bytes": size_bytes,
        "compartido_con_cliente": compartido_con_cliente,
        "estado_revision": "recibido"
    }

    documento = await repo.stage_create(doc_data, created_by_id=current_user.id)
    await NovedadRepository(db, current_user.firma_id).stage_create(
        {
            "asunto_id": asunto_id,
            "asunto_paso_id": active_step.id if active_step else None,
            "documento_id": documento.id,
            "tipo": "documento_incorporado",
            "titulo": "Documento incorporado",
            "descripcion": nombre_funcional,
            "publicado_al_cliente": compartido_con_cliente,
        },
        created_by_id=current_user.id,
    )
    await db.commit()
    await db.refresh(documento)
    return documento

@router.post("/asuntos/{asunto_id}/documentos/vincular", response_model=DocumentoResponse, status_code=status.HTTP_201_CREATED)
async def vincular_documento_drive(
    asunto_id: uuid.UUID,
    payload: DocumentoLinkCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_office_user),
):
    """
    Vincula un archivo ya existente en Google Drive / OneDrive a un expediente.
    """
    asunto = await AsuntoRepository(db, current_user.firma_id).get_by_id(asunto_id)
    if not asunto:
        raise HTTPException(status_code=404, detail="Asunto no encontrado")

    repo = DocumentoRepository(db, current_user.firma_id)
    active_step = next(
        (step for step in asunto.pasos if step.estado == "activo" and step.is_active),
        None,
    )
    target_folder = folder_for_document_type(payload.tipo_documental)
    doc_data = {
        "asunto_id": asunto_id,
        "asunto_paso_id": active_step.id if active_step else None,
        "nombre_funcional": payload.nombre_funcional,
        "tipo_documental": payload.tipo_documental,
        "subcarpeta": target_folder,
        "provider": "google_drive",
        "external_file_id": payload.external_file_id,
        "web_view_url": payload.web_view_url,
        "web_download_url": payload.web_download_url,
        "mime_type": payload.mime_type,
        "tamano_bytes": payload.tamano_bytes,
        "compartido_con_cliente": payload.compartido_con_cliente,
        "estado_revision": "recibido"
    }

    documento = await repo.stage_create(doc_data, created_by_id=current_user.id)
    await NovedadRepository(db, current_user.firma_id).stage_create(
        {
            "asunto_id": asunto_id,
            "asunto_paso_id": active_step.id if active_step else None,
            "documento_id": documento.id,
            "tipo": "documento_incorporado",
            "titulo": "Documento incorporado",
            "descripcion": payload.nombre_funcional,
            "publicado_al_cliente": payload.compartido_con_cliente,
        },
        created_by_id=current_user.id,
    )
    await db.commit()
    await db.refresh(documento)
    return documento

@router.get("/documentos/{documento_id}/preview")
async def preview_documento_proxy(
    documento_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Proxy de previsualización para clientes. Retorna los bytes directamente para previsualizar sin requerir login en Google/OneDrive.
    """
    repo = DocumentoRepository(db, current_user.firma_id)
    doc = await repo.get_by_id(documento_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    if current_user.rol == "cliente":
        asunto = await AsuntoRepository(db, current_user.firma_id).get_by_id(
            doc.asunto_id
        )
        if (
            not asunto
            or asunto.cliente_id != current_user.id
            or not doc.compartido_con_cliente
        ):
            raise HTTPException(status_code=404, detail="Documento no encontrado")

    if doc.provider != "local":
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="El proveedor cloud de este documento todavía no está conectado.",
        )

    storage_root = (Path.cwd() / "storage").resolve()
    file_path = Path(doc.external_file_id).resolve()
    if (
        not file_path.is_relative_to(storage_root)
        or not file_path.is_file()
    ):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    return FileResponse(
        path=file_path,
        media_type=doc.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'inline; filename="{doc.nombre_funcional}.pdf"'
        },
    )

@router.patch("/documentos/{documento_id}/visibilidad", response_model=DocumentoResponse)
async def toggle_visibilidad_documento(
    documento_id: uuid.UUID,
    compartido: bool,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_office_user),
):
    """
    Alterna si el documento es visible para el cliente (compartido_con_cliente = true/false).
    """
    repo = DocumentoRepository(db, current_user.firma_id)
    doc = await repo.toggle_visibilidad(documento_id, compartido)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return doc

@router.delete("/documentos/{documento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_documento(
    documento_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_office_user),
):
    """
    Borrado lógico de documento (Soft Delete).
    """
    repo = DocumentoRepository(db, current_user.firma_id)
    success = await repo.soft_delete(documento_id)
    if not success:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return None
