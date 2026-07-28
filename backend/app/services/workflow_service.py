import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DomainException, NotFoundException
from app.models.asunto import Asunto
from app.models.asunto_paso import AsuntoPaso
from app.repositories.asunto_repository import AsuntoRepository
from app.repositories.paso_repository import PasoRepository


RUTA_INSOLVENCIA_PERSONA_NATURAL: list[dict[str, Any]] = [
    {
        "orden": 1,
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
        "orden": 2,
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
        "orden": 3,
        "codigo": "audiencia_agendada",
        "titulo": "Audiencia agendada",
        "descripcion": "Confirma que la audiencia ocurrió antes de registrar su resultado.",
        "campos": [
            {"clave": "audiencia_realizada", "etiqueta": "La audiencia se realizó", "tipo": "boolean", "requerido": True},
        ],
    },
    {
        "orden": 4,
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
        "orden": 5,
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
        self.pasos = PasoRepository(session, firma_id)

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

    async def advance(
        self,
        asunto_id: uuid.UUID,
        paso_codigo: str,
        data: dict[str, Any],
        user_id: uuid.UUID,
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
        return await self.pasos.complete_and_advance(
            asunto=asunto,
            current=current,
            next_step=next_step,
            data=data,
            user_id=user_id,
        )
