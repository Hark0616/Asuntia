import uuid
from typing import Any, Optional, List
from sqlalchemy import and_, func, or_, select, true
from sqlalchemy.orm import joinedload, selectinload, with_loader_criteria
from app.models.asunto import Asunto
from app.models.cliente import Cliente
from app.models.estado import EstadoProcesal
from app.models.user import User
from app.models.novedad import Novedad
from app.models.tarea import Tarea, TareaEstado, TareaPrioridad, TareaTipo
from app.repositories.base import BaseRepository
from app.repositories.novedad_repository import NovedadRepository

class AsuntoRepository(BaseRepository[Asunto]):
    def __init__(self, session, firma_id: uuid.UUID):
        super().__init__(Asunto, session, firma_id)

    def _load_options(self, solo_publicas: bool = False):
        criteria = (Novedad.firma_id == self.firma_id) & (Novedad.is_active == True)
        if solo_publicas:
            criteria &= NovedadRepository(
                self.session, self.firma_id
            ).public_visibility_condition()
        return (
            joinedload(Asunto.cliente),
            joinedload(Asunto.abogado),
            joinedload(Asunto.estado),
            selectinload(Asunto.novedades),
            selectinload(Asunto.pasos),
            with_loader_criteria(Novedad, criteria, include_aliases=True),
        )

    async def search(
        self, *, pagina: int, por_pagina: int, q: str = "",
        cliente_id: uuid.UUID | None = None, responsable_id: uuid.UUID | None = None,
        estado_id: uuid.UUID | None = None, sin_responsable: bool = False,
        abogado_scope: uuid.UUID | None = None,
    ) -> tuple[list[dict], int]:
        """Una única consulta obtiene página y total bajo la misma instantánea."""
        filtered = (
            select(
                Asunto.id, Asunto.titulo, Asunto.codigo_interno.label("codigo_interno"),
                Asunto.radicado_oficial, Asunto.fecha_apertura, Asunto.cliente_id,
                Cliente.nombre.label("cliente_nombre"), User.id.label("abogado_id"),
                User.nombre.label("responsable_nombre"), EstadoProcesal.id.label("estado_id"),
                EstadoProcesal.nombre.label("estado_nombre"), EstadoProcesal.color_tipo.label("estado_color"),
                Asunto.etapa_actual, Asunto.created_at,
            )
            .join(Cliente, and_(
                Cliente.id == Asunto.cliente_id, Cliente.firma_id == self.firma_id, Cliente.is_active.is_(True),
            ))
            .outerjoin(User, and_(
                User.id == Asunto.abogado_id, User.firma_id == self.firma_id, User.is_active.is_(True),
            ))
            .outerjoin(EstadoProcesal, and_(
                EstadoProcesal.id == Asunto.estado_id, EstadoProcesal.firma_id == self.firma_id,
                EstadoProcesal.is_active.is_(True),
            ))
            .where(Asunto.firma_id == self.firma_id, Asunto.is_active.is_(True))
        )
        if abogado_scope is not None:
            filtered = filtered.where(Asunto.abogado_id == abogado_scope)
        if cliente_id is not None:
            filtered = filtered.where(Asunto.cliente_id == cliente_id)
        if responsable_id is not None:
            filtered = filtered.where(Asunto.abogado_id == responsable_id, User.id.is_not(None))
        if estado_id is not None:
            filtered = filtered.where(Asunto.estado_id == estado_id, EstadoProcesal.id.is_not(None))
        if sin_responsable:
            filtered = filtered.where(Asunto.abogado_id.is_(None))
        if q.strip():
            filtered = filtered.where(or_(*[
                column.icontains(q.strip(), autoescape=True) for column in (
                    Asunto.titulo, Asunto.codigo_interno, Asunto.radicado_oficial,
                    Cliente.nombre, Cliente.numero_documento,
                )
            ]))
        candidates = filtered.cte("asuntos_filtrados")
        page = (
            select(candidates).order_by(candidates.c.created_at.desc(), candidates.c.id.desc())
            .offset((pagina - 1) * por_pagina).limit(por_pagina).cte("pagina")
        )
        totals = select(func.count().label("total")).select_from(candidates).cte("totales")
        result = await self.session.execute(
            select(page, totals.c.total).select_from(totals.outerjoin(page, true()))
            .order_by(page.c.created_at.desc(), page.c.id.desc())
        )
        rows = result.mappings().all()
        return [dict(row) for row in rows if row["id"] is not None], rows[0]["total"]

    async def get_by_id(self, id: uuid.UUID, solo_publicas: bool = False) -> Optional[Asunto]:
        stmt = (
            select(Asunto)
            .options(*self._load_options(solo_publicas))
            .where(Asunto.id == id)
            .where(Asunto.firma_id == self.firma_id)
            .where(Asunto.is_active == True)
            .execution_options(populate_existing=True)
        )
        result = await self.session.execute(stmt)
        return result.scalars().unique().first()

    async def get_by_id_for_update(self, id: uuid.UUID) -> Optional[Asunto]:
        """Serializa cambios del expediente antes de bloquear pasos o tareas."""
        result = await self.session.execute(
            select(Asunto)
            .where(Asunto.id == id)
            .where(Asunto.firma_id == self.firma_id)
            .where(Asunto.is_active == True)
            .with_for_update(of=Asunto)
            .execution_options(populate_existing=True)
        )
        if result.scalars().first() is None:
            return None
        return await self.get_by_id(id)

    async def list(self, skip: int = 0, limit: int = 100) -> List[Asunto]:
        stmt = (
            select(Asunto)
            .options(*self._load_options())
            .where(Asunto.firma_id == self.firma_id)
            .where(Asunto.is_active == True)
            .offset(skip)
            .limit(limit)
            .execution_options(populate_existing=True)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def list_by_abogado_id(
        self,
        abogado_id: uuid.UUID,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Asunto]:
        stmt = (
            select(Asunto)
            .options(*self._load_options())
            .where(Asunto.abogado_id == abogado_id)
            .where(Asunto.firma_id == self.firma_id)
            .where(Asunto.is_active == True)
            .offset(skip)
            .limit(limit)
            .execution_options(populate_existing=True)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def get_by_radicado(self, radicado: str, solo_publicas: bool = False) -> Optional[Asunto]:
        stmt = (
            select(Asunto)
            .options(*self._load_options(solo_publicas))
            .where(Asunto.radicado == radicado)
            .where(Asunto.firma_id == self.firma_id)
            .where(Asunto.is_active == True)
            .execution_options(populate_existing=True)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_by_cliente_id(
        self, cliente_id: uuid.UUID, solo_publicas: bool = False
    ) -> List[Asunto]:
        stmt = (
            select(Asunto)
            .options(*self._load_options(solo_publicas))
            .where(Asunto.cliente_id == cliente_id)
            .where(Asunto.firma_id == self.firma_id)
            .where(Asunto.is_active == True)
            .execution_options(populate_existing=True)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def get_by_portal_user_id(
        self, portal_user_id: uuid.UUID, solo_publicas: bool = False
    ) -> List[Asunto]:
        stmt = (
            select(Asunto)
            .join(Cliente, Cliente.id == Asunto.cliente_id)
            .options(*self._load_options(solo_publicas))
            .where(Cliente.portal_user_id == portal_user_id)
            .where(Cliente.firma_id == self.firma_id)
            .where(Cliente.is_active == True)
            .where(Asunto.firma_id == self.firma_id)
            .where(Asunto.is_active == True)
            .execution_options(populate_existing=True)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def create_pending(
        self,
        asunto_data: dict[str, Any],
        step_definitions: List[dict[str, Any]],
        created_by_id: uuid.UUID,
    ) -> Asunto:
        """Prepara el expediente y su guía; el servicio confirma la operación completa."""
        asunto = Asunto(
            **asunto_data,
            firma_id=self.firma_id,
            created_by_id=created_by_id,
        )
        self.session.add(asunto)
        await self.session.flush()
        if step_definitions:
            await self.stage_workflow(asunto, step_definitions, created_by_id)
        return asunto

    async def stage_workflow(
        self, asunto: Asunto, step_definitions: List[dict[str, Any]], created_by_id: uuid.UUID,
    ) -> None:
        from app.models.asunto_paso import AsuntoPaso

        pasos = [
            AsuntoPaso(
                **{
                    **step,
                    "datos": {"radicado_oficial": asunto.radicado_oficial}
                    if step["codigo"] == "radicacion" and asunto.radicado_oficial else step["datos"],
                },
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
        await self.session.flush()

    def stage_responsible(
        self,
        asunto: Asunto,
        responsable_id: uuid.UUID,
    ) -> None:
        asunto.abogado_id = responsable_id
        self.session.add(asunto)
