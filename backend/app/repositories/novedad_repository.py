import uuid
from typing import Any, List
from sqlalchemy import and_, exists, or_, select, update
from app.models.documento import DocumentoAsunto
from app.models.novedad import Novedad
from app.repositories.base import BaseRepository

class NovedadRepository(BaseRepository[Novedad]):
    def __init__(self, session, firma_id: uuid.UUID):
        super().__init__(Novedad, session, firma_id)

    async def get_by_id_for_update(self, id: uuid.UUID) -> Novedad | None:
        result = await self.session.execute(
            select(Novedad)
            .where(Novedad.id == id)
            .where(Novedad.firma_id == self.firma_id)
            .where(Novedad.is_active == True)
            .with_for_update(of=Novedad)
            .execution_options(populate_existing=True)
        )
        return result.scalars().first()

    def public_visibility_condition(self):
        """Un evento documental público depende del documento que lo originó."""
        documento_visible = (
            exists()
            .where(DocumentoAsunto.id == Novedad.documento_id)
            .where(DocumentoAsunto.asunto_id == Novedad.asunto_id)
            .where(DocumentoAsunto.firma_id == self.firma_id)
            .where(DocumentoAsunto.is_active == True)
            .where(DocumentoAsunto.compartido_con_cliente == True)
            .correlate(Novedad)
        )
        return and_(
            Novedad.publicado_al_cliente == True,
            or_(Novedad.tipo != "documento_incorporado", documento_visible),
        )

    async def stage_document_visibility(
        self,
        documento_id: uuid.UUID,
        asunto_id: uuid.UUID,
        compartido: bool,
        *,
        archived: bool = False,
    ) -> None:
        """Sincroniza solo eventos automáticos; las notas independientes se conservan."""
        values = {"publicado_al_cliente": compartido}
        if archived:
            values["is_active"] = False
        await self.session.execute(
            update(Novedad)
            .where(Novedad.firma_id == self.firma_id)
            .where(Novedad.is_active == True)
            .where(Novedad.asunto_id == asunto_id)
            .where(Novedad.documento_id == documento_id)
            .where(Novedad.tipo == "documento_incorporado")
            .values(**values)
        )

    async def stage_create(
        self,
        data: dict[str, Any],
        created_by_id: uuid.UUID,
    ) -> Novedad:
        novedad = Novedad(
            **data,
            firma_id=self.firma_id,
            created_by_id=created_by_id,
        )
        self.session.add(novedad)
        await self.session.flush()
        return novedad

    async def get_by_asunto_id(self, asunto_id: uuid.UUID, solo_publicas: bool = False) -> List[Novedad]:
        stmt = (
            select(Novedad)
            .where(Novedad.asunto_id == asunto_id)
            .where(Novedad.firma_id == self.firma_id)
            .where(Novedad.is_active == True)
        )
        if solo_publicas:
            stmt = stmt.where(self.public_visibility_condition())
            
        stmt = stmt.order_by(Novedad.created_at.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
