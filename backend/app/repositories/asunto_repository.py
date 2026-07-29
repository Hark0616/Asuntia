import uuid
from typing import Any, Optional, List
from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload, with_loader_criteria
from app.models.asunto import Asunto
from app.models.novedad import Novedad
from app.models.tarea import Tarea, TareaEstado, TareaPrioridad, TareaTipo
from app.repositories.base import BaseRepository

class AsuntoRepository(BaseRepository[Asunto]):
    def __init__(self, session, firma_id: uuid.UUID):
        super().__init__(Asunto, session, firma_id)

    @staticmethod
    def _load_options():
        return (
            joinedload(Asunto.cliente),
            joinedload(Asunto.estado),
            selectinload(Asunto.novedades),
            selectinload(Asunto.pasos),
        )

    async def get_by_id(self, id: uuid.UUID) -> Optional[Asunto]:
        stmt = (
            select(Asunto)
            .options(*self._load_options())
            .where(Asunto.id == id)
            .where(Asunto.firma_id == self.firma_id)
            .where(Asunto.is_active == True)
        )
        result = await self.session.execute(stmt)
        return result.scalars().unique().first()

    async def list(self, skip: int = 0, limit: int = 100) -> List[Asunto]:
        stmt = (
            select(Asunto)
            .options(*self._load_options())
            .where(Asunto.firma_id == self.firma_id)
            .where(Asunto.is_active == True)
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def get_by_radicado(self, radicado: str, solo_publicas: bool = False) -> Optional[Asunto]:
        options = [
            joinedload(Asunto.cliente),
            joinedload(Asunto.estado),
            selectinload(Asunto.novedades),
            selectinload(Asunto.pasos),
        ]
        if solo_publicas:
            options.append(
                with_loader_criteria(
                    Novedad,
                    Novedad.publicado_al_cliente == True,
                    include_aliases=True,
                )
            )
        stmt = (
            select(Asunto)
            .options(*options)
            .where(Asunto.radicado == radicado)
            .where(Asunto.firma_id == self.firma_id)
            .where(Asunto.is_active == True)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_by_cliente_id(
        self, cliente_id: uuid.UUID, solo_publicas: bool = False
    ) -> List[Asunto]:
        options = [
            joinedload(Asunto.cliente),
            joinedload(Asunto.estado),
            selectinload(Asunto.novedades),
            selectinload(Asunto.pasos),
        ]
        if solo_publicas:
            options.append(
                with_loader_criteria(
                    Novedad,
                    Novedad.publicado_al_cliente == True,
                    include_aliases=True,
                )
            )
        stmt = (
            select(Asunto)
            .options(*options)
            .where(Asunto.cliente_id == cliente_id)
            .where(Asunto.firma_id == self.firma_id)
            .where(Asunto.is_active == True)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def create_with_workflow(
        self,
        asunto_data: dict[str, Any],
        step_definitions: List[dict[str, Any]],
        created_by_id: uuid.UUID,
    ) -> Asunto:
        """Crea el expediente y su ruta inicial en una sola transacción."""
        from app.models.asunto_paso import AsuntoPaso

        asunto = Asunto(
            **asunto_data,
            firma_id=self.firma_id,
            created_by_id=created_by_id,
        )
        self.session.add(asunto)
        await self.session.flush()

        pasos = [
            AsuntoPaso(
                **step,
                asunto_id=asunto.id,
                firma_id=self.firma_id,
                created_by_id=created_by_id,
            )
            for step in step_definitions
        ]
        self.session.add_all(pasos)
        await self.session.flush()

        primer_paso = pasos[0]
        if asunto.abogado_id is None:
            raise RuntimeError("El asunto requiere un abogado responsable")
        self.session.add(
            Tarea(
                firma_id=self.firma_id,
                asunto_id=asunto.id,
                asunto_paso_id=primer_paso.id,
                codigo=f"paso:{primer_paso.codigo}",
                tipo=TareaTipo.COMPLETAR_PASO.value,
                titulo=f"Completar {primer_paso.titulo.lower()}",
                instruccion=primer_paso.descripcion,
                estado=TareaEstado.PENDIENTE.value,
                prioridad=TareaPrioridad.NORMAL.value,
                responsable_id=asunto.abogado_id,
                solicitante_id=created_by_id,
                created_by_id=created_by_id,
            )
        )
        await self.session.commit()
        created = await self.get_by_id(asunto.id)
        if created is None:
            raise RuntimeError("El asunto creado no pudo recargarse")
        return created
