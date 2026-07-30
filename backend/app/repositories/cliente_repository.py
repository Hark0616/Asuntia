import uuid
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.cliente import Cliente
from app.repositories.base import BaseRepository


class ClienteRepository(BaseRepository[Cliente]):
    def __init__(self, session, firma_id: uuid.UUID):
        super().__init__(Cliente, session, firma_id)

    async def get_by_id(self, id: uuid.UUID) -> Optional[Cliente]:
        stmt = (
            select(Cliente)
            .options(selectinload(Cliente.asuntos))
            .where(Cliente.id == id)
            .where(Cliente.firma_id == self.firma_id)
            .where(Cliente.is_active == True)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def list(self, skip: int = 0, limit: int = 200) -> list[Cliente]:
        stmt = (
            select(Cliente)
            .options(selectinload(Cliente.asuntos))
            .where(Cliente.firma_id == self.firma_id)
            .where(Cliente.is_active == True)
            .order_by(Cliente.nombre.asc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_document(self, document: str) -> Optional[Cliente]:
        normalized = self.normalize_document(document)
        stmt = (
            select(Cliente)
            .options(selectinload(Cliente.asuntos))
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
            .options(selectinload(Cliente.asuntos))
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
