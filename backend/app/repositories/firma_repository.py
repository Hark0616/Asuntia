from sqlalchemy import select

from app.models.firma import Firma


class FirmaRepository:
    """
    Repositorio del registro raíz de tenants.

    Firma no pertenece a otro tenant, por lo que es la única entidad que no
    puede heredar el filtro de BaseRepository.
    """

    def __init__(self, session):
        self.session = session

    async def get_by_subdominio(self, subdominio: str) -> Firma | None:
        stmt = (
            select(Firma)
            .where(Firma.subdominio == subdominio.strip().lower())
            .where(Firma.is_active == True)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()
