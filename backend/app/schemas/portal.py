import uuid
from datetime import date, datetime

from pydantic import Field

from app.models.asunto import Asunto
from app.schemas.base import BaseSchemaResponse


class NovedadPortalResponse(BaseSchemaResponse):
    id: uuid.UUID
    titulo: str
    descripcion: str
    tipo: str
    created_at: datetime


class AsuntoPortalResponse(BaseSchemaResponse):
    """Proyección externa del expediente con información autorizada."""

    id: uuid.UUID
    radicado: str
    fecha_apertura: date
    responsable_nombre: str | None = None
    ultima_novedad_at: datetime | None = None
    novedades: list[NovedadPortalResponse] = Field(default_factory=list)

    @classmethod
    def from_asunto(cls, asunto: Asunto) -> "AsuntoPortalResponse":
        novedades = sorted(
            (
                novedad
                for novedad in asunto.novedades
                if novedad.is_active and novedad.publicado_al_cliente
            ),
            key=lambda novedad: (novedad.created_at, str(novedad.id)),
            reverse=True,
        )
        return cls(
            id=asunto.id,
            radicado=asunto.radicado,
            fecha_apertura=asunto.fecha_apertura,
            responsable_nombre=asunto.abogado.nombre if asunto.abogado else None,
            # created_at corresponde al registro del avance; no certifica
            # cuándo fue autorizado o publicado al cliente.
            ultima_novedad_at=novedades[0].created_at if novedades else None,
            novedades=[NovedadPortalResponse.model_validate(item) for item in novedades],
        )
