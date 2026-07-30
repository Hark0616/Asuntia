import uuid
from typing import Optional

from sqlalchemy import select

from app.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, session, firma_id: uuid.UUID):
        super().__init__(User, session, firma_id)

    async def get_by_email(self, email: str) -> Optional[User]:
        stmt = (
            select(User)
            .where(User.email == email.strip().lower())
            .where(User.firma_id == self.firma_id)
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

    @staticmethod
    def normalize_cedula(cedula: str) -> str:
        return "".join(character for character in cedula if character.isalnum()).lower()
