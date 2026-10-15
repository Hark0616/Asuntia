import uuid
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.models.cliente import Cliente
from app.models.asunto import Asunto
from app.repositories.base import BaseRepository


class ClienteRepository(BaseRepository[Cliente]):
    def __init__(self, session, firma_id: uuid.UUID):
        super().__init__(Cliente, session, firma_id)

    def _case_count_options(self):
        # Los perfiles solo necesitan contar asuntos; la historia se consulta por expediente.
        return selectinload(Cliente.asuntos.and_(
            Asunto.firma_id == self.firma_id, Asunto.is_active.is_(True),
        )).load_only(Asunto.id, Asunto.is_active).raiseload("*")

    async def get_by_id(self, id: uuid.UUID) -> Optional[Cliente]:
        stmt = (
            select(Cliente)
            .options(self._case_count_options())
            .where(Cliente.id == id)
            .where(Cliente.firma_id == self.firma_id)
            .where(Cliente.is_active == True)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def list(self, skip: int = 0, limit: int = 200, abogado_scope: uuid.UUID | None = None) -> list[dict]:
        """El directorio cuenta asuntos autorizados sin cargar expedientes ni historias."""
        cases_count = select(func.count()).select_from(Asunto).where(
            Asunto.cliente_id == Cliente.id, Asunto.firma_id == self.firma_id, Asunto.is_active.is_(True),
        )
        if abogado_scope is not None:
            cases_count = cases_count.where(Asunto.abogado_id == abogado_scope)
        stmt = (
            select(*Cliente.__table__.c, cases_count.correlate(Cliente).scalar_subquery().label("asuntos_count"))
            .where(Cliente.firma_id == self.firma_id)
            .where(Cliente.is_active == True)
            .order_by(Cliente.nombre.asc(), Cliente.id.asc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return [
            {**row, "cedula": row["numero_documento"], "portal_habilitado": row["portal_user_id"] is not None, "rol": "cliente"}
            for row in result.mappings()
        ]

    async def get_by_document(self, document: str) -> Optional[Cliente]:
        normalized = self.normalize_document(document)
        stmt = (
            select(Cliente)
            .options(self._case_count_options())
            .where(Cliente.firma_id == self.firma_id)
            .where(Cliente.numero_documento_normalizado == normalized)
            .where(Cliente.is_active == True)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_by_portal_user_id(
        self, portal_user_id: uuid.UUID
    ) -> Optional[Cliente]:
        stmt = (
            select(Cliente)
            .options(self._case_count_options())
            .where(Cliente.firma_id == self.firma_id)
            .where(Cliente.portal_user_id == portal_user_id)
            .where(Cliente.is_active == True)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def create(
        self,
        obj_in_data: dict[str, Any],
        created_by_id: Optional[uuid.UUID] = None,
    ) -> Cliente:
        cliente = await self.create_pending(
            obj_in_data, created_by_id=created_by_id
        )
        await self.session.commit()
        await self.session.refresh(cliente)
        return cliente

    async def create_pending(
        self,
        obj_in_data: dict[str, Any],
        created_by_id: Optional[uuid.UUID] = None,
    ) -> Cliente:
        data = {
            **obj_in_data,
            "numero_documento_normalizado": self.normalize_document(
                obj_in_data["numero_documento"]
            ),
            "email": obj_in_data["email"].strip().lower(),
            "firma_id": self.firma_id,
            "created_by_id": created_by_id,
        }
        cliente = Cliente(**data)
        self.session.add(cliente)
        await self.session.flush()
        return cliente

    def stage_responsible(
        self,
        cliente: Cliente,
        responsable_id: uuid.UUID,
    ) -> None:
        cliente.responsable_id = responsable_id
        self.session.add(cliente)

    @staticmethod
    def normalize_document(document: str) -> str:
        return "".join(
            character for character in document if character.isalnum()
        ).lower()
