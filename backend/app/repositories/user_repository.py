import uuid
from typing import Optional

from sqlalchemy import or_, select

from app.models.asunto import Asunto
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

    async def list_clientes(self) -> list[User]:
        stmt = (
            select(User)
            .where(User.firma_id == self.firma_id)
            .where(User.rol == "cliente")
            .where(User.is_active == True)
            .order_by(User.nombre.asc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_clientes_for_lawyer(self, lawyer_id: uuid.UUID) -> list[User]:
        stmt = (
            select(User)
            .outerjoin(
                Asunto,
                (Asunto.cliente_id == User.id)
                & (Asunto.firma_id == self.firma_id)
                & (Asunto.is_active == True),
            )
            .where(User.firma_id == self.firma_id)
            .where(User.rol == "cliente")
            .where(User.is_active == True)
            .where(
                or_(
                    User.created_by_id == lawyer_id,
                    Asunto.abogado_id == lawyer_id,
                )
            )
            .order_by(User.nombre.asc())
            .distinct()
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    def normalize_cedula(cedula: str) -> str:
        return "".join(character for character in cedula if character.isalnum()).lower()
