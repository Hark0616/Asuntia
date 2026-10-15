from sqlalchemy import select
import uuid

from app.models.firma import Firma


class FirmaRepository:
    """
    Repositorio del registro raíz de tenants.

    Firma no pertenece a otro tenant, por lo que es la única entidad que no
    puede heredar el filtro de BaseRepository.
    """

    def __init__(self, session):
        self.session = session

    async def get_by_id(self, firma_id: uuid.UUID) -> Firma | None:
        result = await self.session.execute(
            select(Firma).where(Firma.id == firma_id, Firma.is_active.is_(True))
        )
        return result.scalars().first()

    async def lock_active(self, firma_id: uuid.UUID) -> Firma | None:
        """Serializa cambios de equipo y asignaciones dentro del mismo tenant."""
        result = await self.session.execute(
            select(Firma).where(Firma.id == firma_id, Firma.is_active.is_(True))
            .with_for_update().execution_options(populate_existing=True)
        )
        return result.scalars().first()

    async def get_by_subdominio(self, subdominio: str) -> Firma | None:
        stmt = (
            select(Firma)
            .where(Firma.subdominio == subdominio.strip().lower())
            .where(Firma.is_active == True)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()
