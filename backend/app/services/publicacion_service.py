import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.documento import DocumentoAsunto
from app.repositories.documento_repository import DocumentoRepository
from app.repositories.novedad_repository import NovedadRepository


class PublicacionService:
    """Mantiene documento y evento automático en una única transacción."""

    def __init__(self, session: AsyncSession, firma_id: uuid.UUID):
        self.session = session
        self.documentos = DocumentoRepository(session, firma_id)
        self.novedades = NovedadRepository(session, firma_id)

    async def set_document_visibility(
        self, documento: DocumentoAsunto, compartido: bool
    ) -> DocumentoAsunto:
        self.documentos.stage_visibility(documento, compartido)
        await self.novedades.stage_document_visibility(
            documento.id, documento.asunto_id, compartido
        )
        await self.session.commit()
        await self.session.refresh(documento)
        return documento

    async def archive_document(self, documento: DocumentoAsunto) -> None:
        self.documentos.stage_archive(documento)
        await self.novedades.stage_document_visibility(
            documento.id, documento.asunto_id, False, archived=True
        )
        await self.session.commit()
