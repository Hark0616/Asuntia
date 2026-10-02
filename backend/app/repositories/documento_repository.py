import uuid
from typing import Any, List, Optional
from sqlalchemy import select
from app.repositories.base import BaseRepository
from app.models.documento import DocumentoAsunto

class DocumentoRepository(BaseRepository[DocumentoAsunto]):
    def __init__(self, session, firma_id: uuid.UUID):
        super().__init__(DocumentoAsunto, session, firma_id)

    async def get_by_id_for_update(self, documento_id: uuid.UUID) -> Optional[DocumentoAsunto]:
        stmt = (
            select(DocumentoAsunto)
            .where(DocumentoAsunto.id == documento_id)
            .where(DocumentoAsunto.firma_id == self.firma_id)
            .where(DocumentoAsunto.is_active == True)
            .with_for_update(of=DocumentoAsunto)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    def stage_visibility(self, documento: DocumentoAsunto, compartido: bool) -> None:
        documento.compartido_con_cliente = compartido
        self.session.add(documento)

    def stage_archive(self, documento: DocumentoAsunto) -> None:
        documento.is_active = False
        documento.compartido_con_cliente = False
        self.session.add(documento)

    async def stage_create(
        self,
        data: dict[str, Any],
        created_by_id: uuid.UUID,
    ) -> DocumentoAsunto:
        documento = DocumentoAsunto(
            **data,
            firma_id=self.firma_id,
            created_by_id=created_by_id,
        )
        self.session.add(documento)
        await self.session.flush()
        return documento

    async def list_by_asunto(self, asunto_id: uuid.UUID, solo_compartidos: bool = False) -> List[DocumentoAsunto]:
        stmt = select(DocumentoAsunto).where(
            DocumentoAsunto.firma_id == self.firma_id,
            DocumentoAsunto.asunto_id == asunto_id,
            DocumentoAsunto.is_active == True
        )
        if solo_compartidos:
            stmt = stmt.where(DocumentoAsunto.compartido_con_cliente == True)

        stmt = stmt.order_by(DocumentoAsunto.created_at.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
