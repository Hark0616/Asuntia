import uuid
from typing import List, Optional
from sqlalchemy import select
from app.repositories.base import BaseRepository
from app.models.documento import DocumentoAsunto

class DocumentoRepository(BaseRepository[DocumentoAsunto]):
    def __init__(self, session, firma_id: uuid.UUID):
        super().__init__(DocumentoAsunto, session, firma_id)

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

    async def toggle_visibilidad(self, documento_id: uuid.UUID, compartido: bool) -> Optional[DocumentoAsunto]:
        doc = await self.get_by_id(documento_id)
        if not doc:
            return None
        doc.compartido_con_cliente = compartido
        await self.session.commit()
        await self.session.refresh(doc)
        return doc
