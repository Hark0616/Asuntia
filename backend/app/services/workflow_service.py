import uuid
from typing import Any

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
    def _validate_step_data(step: AsuntoPaso, data: dict[str, Any]) -> None:
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
    ) -> Asunto:
        asunto = await self.asuntos.get_by_id(asunto_id)
        if not asunto:
            raise NotFoundException(detail="Asunto no encontrado")
        if asunto.flujo_estado == "completado":
            raise DomainException(detail="El flujo del asunto ya está completado", status_code=409)

        current = await self.pasos.get_current_for_update(asunto_id)
        if not current:
            raise DomainException(detail="El asunto no tiene un paso activo", status_code=409)
        if current.codigo != paso_codigo:
            raise DomainException(
                detail=f"El paso activo es '{current.titulo}'",
                status_code=409,
            )

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
