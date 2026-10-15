import uuid
from datetime import date
from secrets import token_hex

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DomainException, NotFoundException
from app.models.asunto import Asunto
from app.models.user import User
from app.repositories.asunto_repository import AsuntoRepository
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.estado_repository import EstadoRepository
from app.repositories.user_repository import UserRepository
from app.schemas.asunto import AperturaAsuntoCreate, AsuntoCreate, AsuntoResponse
from app.services.cliente_service import ClienteService
from app.services.workflow_service import initial_workflow_steps


class AsuntoService:
    """Confirma cliente, expediente y guía opcional como un único caso de uso."""

    def __init__(self, session: AsyncSession, firma_id: uuid.UUID):
        self.session = session
        self.firma_id = firma_id
        self.asuntos = AsuntoRepository(session, firma_id)

    async def resolve_responsible(self, actor: User, requested: uuid.UUID | None) -> uuid.UUID:
        if actor.rol == "abogado" and requested not in {None, actor.id}:
            raise DomainException(detail="Un abogado sólo puede asignarse asuntos a sí mismo", status_code=403)
        responsible_id = requested or (actor.id if actor.rol in {"administrador", "abogado"} else None)
        if responsible_id is None:
            raise DomainException(detail="Debes asignar un abogado responsable al abrir el asunto", status_code=422)
        if not await UserRepository(self.session, self.firma_id).get_case_responsible(responsible_id):
            raise NotFoundException(detail="Abogado no encontrado")
        return responsible_id

    @staticmethod
    def workflow_data(ruta_codigo: str | None) -> tuple[dict, list[dict]]:
        if ruta_codigo is None:
            return {
                "ruta_codigo": None, "paso_actual": None, "flujo_estado": None,
                "etapa_actual": "Sin guía", "siguiente_paso": "Sin acción de guía",
            }, []
        steps = initial_workflow_steps()
        return {
            "ruta_codigo": ruta_codigo, "paso_actual": 1, "flujo_estado": "activo",
            "etapa_actual": f"Paso 1 de {len(steps)}: {steps[0]['titulo']}",
            "siguiente_paso": steps[0]["descripcion"],
        }, steps

    async def open(self, payload: AsuntoCreate | AperturaAsuntoCreate, actor: User) -> Asunto:
        try:
            responsible_id = await self.resolve_responsible(actor, payload.abogado_id)
            cliente_id = payload.cliente_id
            if isinstance(payload, AperturaAsuntoCreate) and payload.cliente_nuevo:
                cliente = await ClienteService(self.session, self.firma_id).create(
                    payload.cliente_nuevo, created_by_id=actor.id, commit=False,
                    responsable_id=responsible_id,
                )
                cliente_id = cliente.id
            if cliente_id is None or not await ClienteRepository(self.session, self.firma_id).get_by_id(cliente_id):
                raise NotFoundException(detail="Cliente no encontrado")

            estado_id = payload.estado_id if isinstance(payload, AsuntoCreate) else None
            if estado_id and not await EstadoRepository(self.session, self.firma_id).get_by_id(estado_id):
                raise NotFoundException(detail="Estado procesal no encontrado")

            workflow, steps = self.workflow_data(payload.ruta_codigo)
            supplied_code = payload.codigo_interno if isinstance(payload, AsuntoCreate) else None
            for _ in range(10):
                codigo = supplied_code or f"AS-{date.today().year}-{token_hex(3).upper()}"
                try:
                    # La restricción única arbitra también códigos archivados y concurrencia.
                    async with self.session.begin_nested():
                        asunto = await self.asuntos.create_pending(
                            {
                                "titulo": payload.titulo, "codigo_interno": codigo,
                                "radicado_oficial": payload.radicado_oficial,
                                "cliente_id": cliente_id, "abogado_id": responsible_id,
                                "estado_id": estado_id, "fecha_apertura": payload.fecha_apertura,
                                **workflow,
                            }, steps, created_by_id=actor.id,
                        )
                    break
                except IntegrityError as error:
                    if "uq_asuntos_firma_codigo_interno" not in str(error.orig):
                        raise
                    if supplied_code:
                        raise DomainException(detail="Ya existe un expediente con ese código interno", status_code=409) from error
            else:
                raise DomainException(detail="No fue posible asignar un código interno al expediente", status_code=503)
            # Serializar antes del commit también detecta fallos de carga sin guardar parcialmente.
            created = await self.asuntos.get_by_id(asunto.id)
            if created is None:
                raise RuntimeError("El asunto creado no pudo recargarse")
            AsuntoResponse.model_validate(created)
            await self.session.commit()
            return created
        except Exception:
            await self.session.rollback()
            raise

    async def attach_workflow(self, asunto_id: uuid.UUID, ruta_codigo: str, actor: User) -> Asunto:
        try:
            asunto = await self.asuntos.get_by_id_for_update(asunto_id)
            if asunto is None or (actor.rol == "abogado" and asunto.abogado_id != actor.id):
                raise NotFoundException(detail="Asunto no encontrado")
            if asunto.ruta_codigo is not None or asunto.pasos:
                raise DomainException(detail="El expediente ya tiene una guía", status_code=409)
            if asunto.abogado_id is None or not await UserRepository(self.session, self.firma_id).get_case_responsible(asunto.abogado_id):
                raise DomainException(detail="El asunto requiere un abogado responsable activo", status_code=409)
            workflow, steps = self.workflow_data(ruta_codigo)
            for field, value in workflow.items():
                setattr(asunto, field, value)
            await self.asuntos.stage_workflow(asunto, steps, actor.id)
            updated = await self.asuntos.get_by_id(asunto_id)
            AsuntoResponse.model_validate(updated)
            await self.session.commit()
            return updated
        except Exception:
            await self.session.rollback()
            raise
