import uuid

from sqlalchemy import select

from app.models.auth_challenge import AuthChallenge
from app.repositories.base import BaseRepository


class AuthChallengeRepository(BaseRepository[AuthChallenge]):
    def __init__(self, session, firma_id: uuid.UUID):
        super().__init__(AuthChallenge, session, firma_id)

    async def get_latest_active(
        self, user_id: uuid.UUID, purpose: str
    ) -> AuthChallenge | None:
        stmt = (
            select(AuthChallenge)
            .where(AuthChallenge.firma_id == self.firma_id)
            .where(AuthChallenge.user_id == user_id)
            .where(AuthChallenge.purpose == purpose)
            .where(AuthChallenge.is_active == True)
            .order_by(AuthChallenge.created_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def deactivate_for_user(self, user_id: uuid.UUID, purpose: str) -> None:
        stmt = (
            select(AuthChallenge)
            .where(AuthChallenge.firma_id == self.firma_id)
            .where(AuthChallenge.user_id == user_id)
            .where(AuthChallenge.purpose == purpose)
            .where(AuthChallenge.is_active == True)
        )
        result = await self.session.execute(stmt)
        for challenge in result.scalars().all():
            challenge.is_active = False
            self.session.add(challenge)
        await self.session.commit()
