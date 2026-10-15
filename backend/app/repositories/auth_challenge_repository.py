import uuid

from sqlalchemy import select, update

from app.models.auth_challenge import AuthChallenge
from app.repositories.base import BaseRepository


class AuthChallengeRepository(BaseRepository[AuthChallenge]):
    def __init__(self, session, firma_id: uuid.UUID):
        super().__init__(AuthChallenge, session, firma_id)

    async def get_invitation_for_update(self, challenge_id: uuid.UUID) -> AuthChallenge | None:
        result = await self.session.execute(
            select(AuthChallenge).where(AuthChallenge.id == challenge_id,
                AuthChallenge.firma_id == self.firma_id,
                AuthChallenge.purpose == "team_activation", AuthChallenge.is_active.is_(True))
            .with_for_update().execution_options(populate_existing=True)
        )
        return result.scalars().first()

    async def stage_revoke_invitations(self, user_id: uuid.UUID) -> None:
        await self.session.execute(
            update(AuthChallenge).where(AuthChallenge.firma_id == self.firma_id,
                AuthChallenge.user_id == user_id, AuthChallenge.purpose == "team_activation",
                AuthChallenge.is_active.is_(True)).values(is_active=False)
        )

    async def stage_invitation(self, user_id, code_hash, expires_at, actor_id) -> AuthChallenge:
        challenge = AuthChallenge(firma_id=self.firma_id, user_id=user_id,
            purpose="team_activation", code_hash=code_hash, expires_at=expires_at,
            created_by_id=actor_id)
        self.session.add(challenge)
        await self.session.flush()
        return challenge

    async def pending_invitation_users(self, now) -> set[uuid.UUID]:
        result = await self.session.scalars(
            select(AuthChallenge.user_id).where(AuthChallenge.firma_id == self.firma_id,
                AuthChallenge.purpose == "team_activation", AuthChallenge.is_active.is_(True),
                AuthChallenge.consumed_at.is_(None), AuthChallenge.expires_at > now)
        )
        return set(result.all())

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
