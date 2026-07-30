import uuid
from typing import Any, Optional

from sqlalchemy import select

from app.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, session, firma_id: uuid.UUID):
        super().__init__(User, session, firma_id)

    async def get_office_by_email(self, email: str) -> Optional[User]:
        stmt = (
            select(User)
            .where(User.email == email.strip().lower())
            .where(User.firma_id == self.firma_id)
            .where(User.rol.in_(("administrador", "abogado", "auxiliar")))
            .where(User.is_active == True)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_by_cedula(self, cedula: str) -> Optional[User]:
        normalized = self.normalize_cedula(cedula)
        stmt = (
            select(User)
            .where(User.firma_id == self.firma_id)
            .where(User.is_active == True)
        )
        result = await self.session.execute(stmt)
        return next(
            (
                user
                for user in result.scalars().all()
                if self.normalize_cedula(user.cedula) == normalized
            ),
            None,
        )

    async def list_case_responsibles(self) -> list[User]:
        stmt = (
            select(User)
            .where(User.firma_id == self.firma_id)
            .where(User.rol.in_(("administrador", "abogado")))
            .where(User.is_active == True)
            .order_by(User.nombre.asc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_case_responsible(
        self, user_id: uuid.UUID
    ) -> Optional[User]:
        user = await self.get_by_id(user_id)
        if user and user.rol in {"administrador", "abogado"}:
            return user
        return None

    async def create_pending(
        self,
        obj_in_data: dict[str, Any],
        created_by_id: Optional[uuid.UUID] = None,
    ) -> User:
        user = User(
            **obj_in_data,
            firma_id=self.firma_id,
            created_by_id=created_by_id,
        )
        self.session.add(user)
        await self.session.flush()
        return user

    @staticmethod
    def normalize_cedula(cedula: str) -> str:
        return "".join(character for character in cedula if character.isalnum()).lower()
