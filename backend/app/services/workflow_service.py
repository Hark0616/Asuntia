import uuid
from datetime import date, datetime
from typing import Any
from urllib.parse import urlsplit

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DomainException, ForbiddenException, NotFoundException
from app.models.asunto import Asunto
from app.models.asunto_paso import AsuntoPaso
from app.repositories.asunto_repository import AsuntoRepository
from app.repositories.novedad_repository import NovedadRepository
from app.repositories.paso_repository import PasoRepository
from app.repositories.tarea_repository import TareaRepository


RUTA_INSOLVENCIA_PERSONA_NATURAL: list[dict[str, Any]] = [
    {
        "orden": 1,
        "codigo": "recepcion_evaluacion",
        "titulo": "Recepción y evaluación inicial",
        "descripcion": "Verifica la identidad y la viabilidad preliminar antes de preparar la solicitud.",
        "campos": [
            {"clave": "identidad_verificada", "etiqueta": "Identidad verificada", "tipo": "boolean", "requerido": True},
            {"clave": "viabilidad_preliminar", "etiqueta": "Viabilidad preliminar", "tipo": "select", "requerido": True, "opciones": [
                {"valor": "viable", "etiqueta": "Viable"},
                {"valor": "condicionada", "etiqueta": "Viable con condición"},
                {"valor": "informacion_insuficiente", "etiqueta": "Información insuficiente"},
            ]},
            {"clave": "observaciones", "etiqueta": "Observaciones de recepción", "tipo": "textarea", "requerido": True},
        ],
    },
    {
        "orden": 2,
        "codigo": "preparacion_solicitud",
        "titulo": "Preparación de la solicitud",
        "descripcion": "Confirma que la información, los documentos y el escrito están listos para revisión y presentación.",
        "campos": [
            {"clave": "documentacion_completa", "etiqueta": "Documentación inicial completa", "tipo": "boolean", "requerido": True},
            {"clave": "solicitud_revisada", "etiqueta": "Solicitud revisada por abogado", "tipo": "boolean", "requerido": True},
            {"clave": "observaciones", "etiqueta": "Observaciones de preparación", "tipo": "textarea", "requerido": True},
        ],
    },
    {
        "orden": 3,
        "codigo": "radicacion",
        "titulo": "Radicación",
        "descripcion": "Registra la radicación oficial y la autoridad que recibe el trámite.",
        "campos": [
            {"clave": "radicado_oficial", "etiqueta": "Radicado oficial", "tipo": "text", "requerido": True},
            {"clave": "autoridad", "etiqueta": "Centro de conciliación o notaría", "tipo": "text", "requerido": True},
            {"clave": "fecha_radicacion", "etiqueta": "Fecha de radicación", "tipo": "date", "requerido": True},
        ],
    },
    {
        "orden": 4,
        "codigo": "agendar_audiencia",
        "titulo": "Agendar audiencia",
        "descripcion": "Define fecha, hora y medio de la audiencia.",
        "campos": [
            {"clave": "fecha_hora", "etiqueta": "Fecha y hora", "tipo": "datetime", "requerido": True},
            {"clave": "modalidad", "etiqueta": "Modalidad", "tipo": "select", "requerido": True, "opciones": [
                {"valor": "virtual", "etiqueta": "Virtual"},
                {"valor": "presencial", "etiqueta": "Presencial"},
            ]},
            {"clave": "enlace_o_lugar", "etiqueta": "Enlace o lugar", "tipo": "text", "requerido": True},
        ],
    },
    {
        "orden": 5,
        "codigo": "audiencia_agendada",
        "titulo": "Audiencia agendada",
        "descripcion": "Confirma que la audiencia ocurrió antes de registrar su resultado.",
        "campos": [
            {"clave": "audiencia_realizada", "etiqueta": "La audiencia se realizó", "tipo": "boolean", "requerido": True},
        ],
    },
    {
        "orden": 6,
        "codigo": "resultado_audiencia",
        "titulo": "Resultado de audiencia",
        "descripcion": "Registra lo ocurrido y la conclusión procesal de la audiencia.",
        "campos": [
            {"clave": "resumen", "etiqueta": "Resumen de la audiencia", "tipo": "textarea", "requerido": True},
            {"clave": "resultado", "etiqueta": "Resultado", "tipo": "select", "requerido": True, "opciones": [
                {"valor": "acuerdo", "etiqueta": "Acuerdo"},
                {"valor": "sin_acuerdo", "etiqueta": "Sin acuerdo"},
            ]},
        ],
    },
    {
        "orden": 7,
        "codigo": "definicion",
        "titulo": "Definición",
        "descripcion": "Formaliza el acuerdo o el paso a liquidación patrimonial.",
        "campos": [
            {"clave": "definicion", "etiqueta": "Definición del trámite", "tipo": "select", "requerido": True, "opciones": [
                {"valor": "acuerdo", "etiqueta": "Acuerdo confirmado"},
                {"valor": "fracaso", "etiqueta": "Fracaso y paso a liquidación"},
            ]},
            {"clave": "observaciones", "etiqueta": "Observaciones", "tipo": "textarea", "requerido": True},
        ],
    },
]


def initial_workflow_steps() -> list[dict[str, Any]]:
    return [
        {
            **step,
            "estado": "activo" if step["orden"] == 1 else "bloqueado",
            "datos": {},
        }
        for step in RUTA_INSOLVENCIA_PERSONA_NATURAL
    ]


class WorkflowService:
    def __init__(self, session: AsyncSession, firma_id: uuid.UUID):
        self.asuntos = AsuntoRepository(session, firma_id)
        self.novedades = NovedadRepository(session, firma_id)
        self.pasos = PasoRepository(session, firma_id)
        self.tareas = TareaRepository(session, firma_id)

    @staticmethod
    def _merge_step_data(step: AsuntoPaso, supplied: dict[str, Any]) -> dict[str, Any]:
        """Valida una captura parcial; null retira el valor previamente guardado."""
        fields = {field["clave"]: field for field in step.campos}
        if set(supplied) - fields.keys():
            raise DomainException(detail="La captura contiene campos ajenos al paso", status_code=422)
        merged = dict(step.datos)
        for key, value in supplied.items():
            if value is None:
                merged.pop(key, None)
                continue
            field = fields[key]
            kind = field["tipo"]
            if kind == "boolean":
                if not isinstance(value, bool):
                    raise DomainException(detail=f"El campo '{field['etiqueta']}' debe ser verdadero o falso")
            elif not isinstance(value, str):
                raise DomainException(detail=f"El campo '{field['etiqueta']}' debe ser texto")
            elif value.strip():
                if kind == "select" and value not in {option["valor"] for option in field.get("opciones", [])}:
                    raise DomainException(detail=f"Valor inválido para '{field['etiqueta']}'")
                if kind in {"date", "datetime"}:
                    try:
                        if kind == "date":
                            parsed = date.fromisoformat(value)
                            if parsed.isoformat() != value:
                                raise ValueError
                        else:
                            if "T" not in value:
                                raise ValueError
                            datetime.fromisoformat(value)
                    except ValueError:
                        raise DomainException(detail=f"Fecha inválida para '{field['etiqueta']}'")
                if kind == "url":
                    try:
                        url = urlsplit(value)
                        valid_url = url.scheme in {"http", "https"} and bool(url.hostname)
                    except ValueError:
                        valid_url = False
                    if not valid_url:
                        raise DomainException(detail=f"Enlace inválido para '{field['etiqueta']}'")
            merged[key] = value
        return merged

    @staticmethod
    def _check_version(step: AsuntoPaso, expected_updated_at: datetime | None) -> None:
        if expected_updated_at is not None and step.updated_at != expected_updated_at:
            raise DomainException(
                detail="El paso cambió desde que lo abriste. Revisa los datos guardados antes de continuar.",
                status_code=409,
            )

    async def _get_active_step(
        self, asunto_id: uuid.UUID, paso_codigo: str, user_id: uuid.UUID, user_role: str,
    ) -> tuple[Asunto, AsuntoPaso]:
        asunto = await self.asuntos.get_by_id_for_update(asunto_id)
        if not asunto or (user_role == "abogado" and asunto.abogado_id != user_id):
            raise NotFoundException(detail="Asunto no encontrado")
        if user_role not in {"administrador", "abogado", "auxiliar"}:
            raise ForbiddenException(detail="No puedes capturar datos en este asunto")
        if asunto.flujo_estado == "completado":
            raise DomainException(detail="El flujo del asunto ya está completado", status_code=409)
        current = await self.pasos.get_current_for_update(asunto_id)
        if not current:
            raise DomainException(detail="El asunto no tiene un paso activo", status_code=409)
        if current.codigo != paso_codigo:
            raise DomainException(detail=f"El paso activo es '{current.titulo}'", status_code=409)
        return asunto, current

    async def save_draft(
        self, asunto_id: uuid.UUID, paso_codigo: str, data: dict[str, Any],
        user_id: uuid.UUID, user_role: str, expected_updated_at: datetime,
    ) -> Asunto:
        _, current = await self._get_active_step(asunto_id, paso_codigo, user_id, user_role)
        self._check_version(current, expected_updated_at)
        return await self.pasos.save_draft(current, self._merge_step_data(current, data))

    @staticmethod
    def _validate_step_data(step: AsuntoPaso, data: dict[str, Any]) -> None:
        # También valida capturas previas antes de convertirlas en un paso completado.
        WorkflowService._merge_step_data(step, data)
        for field in step.campos:
            key = field["clave"]
            value = data.get(key)
            if field.get("requerido", True) and (
                value is None or (isinstance(value, str) and not value.strip())
            ):
                raise DomainException(detail=f"El campo '{field['etiqueta']}' es obligatorio")

            if field["tipo"] == "select" and value is not None:
                allowed = {option["valor"] for option in field.get("opciones", [])}
                if value not in allowed:
                    raise DomainException(detail=f"Valor inválido para '{field['etiqueta']}'")

            if field["tipo"] == "boolean" and not isinstance(value, bool):
                raise DomainException(detail=f"El campo '{field['etiqueta']}' debe ser verdadero o falso")

        if step.codigo == "audiencia_agendada" and data.get("audiencia_realizada") is not True:
            raise DomainException(
                detail="Para avanzar debe confirmarse que la audiencia fue realizada"
            )
        if step.codigo == "recepcion_evaluacion" and data.get("identidad_verificada") is not True:
            raise DomainException(
                detail="La identidad debe quedar verificada antes de avanzar"
            )
        if (
            step.codigo == "recepcion_evaluacion"
            and data.get("viabilidad_preliminar") != "viable"
        ):
            raise DomainException(
                detail="La viabilidad debe estar confirmada antes de avanzar",
                status_code=409,
            )
        if step.codigo == "preparacion_solicitud" and (
            data.get("documentacion_completa") is not True
            or data.get("solicitud_revisada") is not True
        ):
            raise DomainException(
                detail="La documentación y la solicitud deben estar revisadas antes de radicar"
            )

    async def advance(
        self,
        asunto_id: uuid.UUID,
        paso_codigo: str,
        data: dict[str, Any],
        user_id: uuid.UUID,
        user_role: str,
        expected_updated_at: datetime | None = None,
    ) -> Asunto:
        if user_role not in {"administrador", "abogado"}:
            raise ForbiddenException(detail="Solo el abogado responsable o administrador puede completar el paso")
        asunto, current = await self._get_active_step(asunto_id, paso_codigo, user_id, user_role)
        self._check_version(current, expected_updated_at)
        data = self._merge_step_data(current, data)
        self._validate_step_data(current, data)
        next_step = await self.pasos.get_by_order(asunto_id, current.orden + 1)
        current_task = await self.tareas.get_open_for_step_for_update(
            asunto_id, current.id
        )
        if current_task is None:
            raise DomainException(
                detail="El paso activo no tiene una tarea abierta asociada",
                status_code=409,
            )
        if (
            user_role != "administrador"
            and current_task.responsable_id != user_id
        ):
            raise ForbiddenException(
                detail="Esta tarea está asignada a otro responsable"
            )
        self.tareas.stage_complete_from_workflow(
            current_task,
            actor_id=user_id,
            resultado=f"Paso validado: {current.titulo}",
        )
        if next_step:
            if asunto.abogado_id is None:
                raise DomainException(
                    detail="El asunto no tiene abogado responsable",
                    status_code=409,
                )
            self.tareas.stage_for_step(
                asunto,
                next_step,
                responsable_id=asunto.abogado_id,
                solicitante_id=user_id,
            )
        await self.novedades.stage_create(
            {
                "asunto_id": asunto.id,
                "asunto_paso_id": current.id,
                "tipo": "paso_completado",
                "titulo": current.titulo,
                "descripcion": f"Se completó el paso: {current.titulo}.",
                "publicado_al_cliente": False,
            },
            created_by_id=user_id,
        )
        return await self.pasos.complete_and_advance(
            asunto=asunto,
            current=current,
            next_step=next_step,
            data=data,
            user_id=user_id,
            total_steps=len(asunto.pasos),
        )
