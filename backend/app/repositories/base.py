import uuid
from typing import Generic, TypeVar, Type, Optional, List, Any
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.base import BaseModel

ModelType = TypeVar("ModelType", bound=BaseModel)

class BaseRepository(Generic[ModelType]):
    """
    Repositorio base multi-tenant.
    Encapsula el filtro automático por firma_id e is_active=True para prevenir fugas de datos entre firmas.
    """
    def __init__(self, model: Type[ModelType], session: AsyncSession, firma_id: uuid.UUID):
        self.model = model
        self.session = session
        self.firma_id = firma_id

    async def get_by_id(self, id: uuid.UUID) -> Optional[ModelType]:
        stmt = (
            select(self.model)
            .where(self.model.id == id)
            .where(self.model.firma_id == self.firma_id)
            .where(self.model.is_active == True)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def list(self, skip: int = 0, limit: int = 100) -> List[ModelType]:
        stmt = (
            select(self.model)
            .where(self.model.firma_id == self.firma_id)
            .where(self.model.is_active == True)
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, obj_in_data: dict[str, Any], created_by_id: Optional[uuid.UUID] = None) -> ModelType:
        obj_in_data["firma_id"] = self.firma_id
        if created_by_id:
            obj_in_data["created_by_id"] = created_by_id
        
        db_obj = self.model(**obj_in_data)
        self.session.add(db_obj)
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def update(self, db_obj: ModelType, obj_in_data: dict[str, Any]) -> ModelType:
        for field, value in obj_in_data.items():
            if hasattr(db_obj, field) and field not in ("id", "firma_id", "created_at"):
                setattr(db_obj, field, value)
        
        self.session.add(db_obj)
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def soft_delete(self, id: uuid.UUID) -> bool:
        db_obj = await self.get_by_id(id)
        if not db_obj:
            return False
        
        db_obj.is_active = False
        self.session.add(db_obj)
        await self.session.commit()
        return True
