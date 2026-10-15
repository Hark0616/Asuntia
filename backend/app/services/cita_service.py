import hashlib
import json
import uuid
from datetime import datetime, timezone

from app.core.access import can_access_asunto
from app.core.exceptions import DomainException, NotFoundException, UnauthorizedException
from app.repositories.asunto_repository import AsuntoRepository
from app.repositories.cita_repository import CitaRepository
from app.repositories.user_repository import UserRepository
from app.schemas.cita import CitaDatos, CitaResponse
from app.services.office_lock import lock_office_actor


class CitaService:
    """Una transacción para cita, participantes validados e historial."""
    def __init__(self, session, firma_id):
        self.session, self.firma_id = session, firma_id
        self.citas = CitaRepository(session, firma_id)
        self.asuntos = AsuntoRepository(session, firma_id)
        self.users = UserRepository(session, firma_id)

    async def _case(self, asunto_id, actor, *, lock=False):
        asunto = await (self.asuntos.get_by_id_for_update(asunto_id) if lock else self.asuntos.get_by_id(asunto_id))
        if (not asunto or not can_access_asunto(actor, asunto)
                or asunto.cliente.firma_id != self.firma_id or not asunto.cliente.is_active):
            raise NotFoundException(detail="Asunto no encontrado")
        return asunto

    async def _lock_actor(self, actor):
        revision = actor.updated_at
        current = await lock_office_actor(self.session, self.firma_id, actor.id, actor.rol)
        if current.updated_at != revision:
            raise UnauthorizedException(detail="Sesión inválida o expirada")

    async def _people(self, data, asunto):
        for user_id in {data.responsable_id, *data.participantes_ids}:
            user = await self.users.get_by_id(user_id)
            if not user or user.rol not in {"administrador", "abogado", "auxiliar"}:
                raise NotFoundException(detail="Miembro del equipo no encontrado")
            if user.rol == "abogado" and asunto.abogado_id != user.id:
                raise DomainException(detail="El abogado participante debe tener el asunto a su cargo")

    @staticmethod
    def _data(payload):
        data = payload.model_dump(include=set(CitaDatos.model_fields))
        data["inicio"] = data["inicio"].astimezone(timezone.utc)
        data["fin"] = data["fin"].astimezone(timezone.utc)
        data["participantes_ids"] = sorted(str(value) for value in data["participantes_ids"])
        return data

    @staticmethod
    def snapshot(cita):
        data = {key: getattr(cita, key) for key in CitaDatos.model_fields}
        return {**{key: value.isoformat() if isinstance(value, datetime) else str(value) if isinstance(value, uuid.UUID)
                   else value for key, value in data.items()},
                "estado": cita.estado, "motivo_cancelacion": cita.motivo_cancelacion}

    async def list(self, asunto_id, actor):
        await self._case(asunto_id, actor)
        return await self.citas.by_asunto(asunto_id)

    def stage_transfer(self, cita, source_id, target_id, actor_id):
        before = self.snapshot(cita)
        if cita.responsable_id == source_id:
            cita.responsable_id = target_id
        cita.participantes_ids = sorted({str(target_id) if value == str(source_id) else value
                                         for value in cita.participantes_ids})
        after = self.snapshot(cita)
        if before != after:
            self.citas.stage_change(cita, "transferida", before, after, actor_id)

    async def get(self, cita_id, actor):
        cita = await self.citas.get_detail(cita_id)
        if not cita or not can_access_asunto(actor, cita.asunto):
            raise NotFoundException(detail="Cita no encontrada")
        return cita

    async def create(self, payload, actor):
        try:
            await self._lock_actor(actor)
            asunto = await self._case(payload.asunto_id, actor, lock=True)
            data = self._data(payload)
            fingerprint = hashlib.sha256(json.dumps({**CitaDatos(**data).model_dump(mode="json"),
                "asunto_id": str(asunto.id), "actor_id": str(actor.id)}, sort_keys=True).encode()).hexdigest()
            existing = await self.citas.by_operation(payload.operacion_id)
            if existing:
                if existing.asunto_id != asunto.id or existing.solicitud_hash != fingerprint:
                    raise DomainException(detail="La solicitud ya se utilizó con otros datos", status_code=409)
                await self.session.commit()
                return existing
            await self._people(payload, asunto)
            cita = self.citas.stage_create({**data, "asunto_id": asunto.id,
                "operacion_id": payload.operacion_id, "solicitud_hash": fingerprint}, actor.id)
            await self.session.flush()
            self.citas.stage_change(cita, "creada", None, self.snapshot(cita), actor.id)
            result = await self._finish(cita.id)
            return result
        except Exception:
            await self.session.rollback()
            raise

    async def _finish(self, cita_id):
        await self.session.flush()
        result = await self.citas.get_detail(cita_id)
        CitaResponse.model_validate(result)
        await self.session.commit()
        return result

    async def change(self, cita_id, payload, actor, *, cancel=False):
        try:
            await self._lock_actor(actor)
            original = await self.get(cita_id, actor)
            asunto = await self._case(original.asunto_id, actor, lock=True)
            cita = await self.citas.get_detail(cita_id, lock=True)
            if not cita:
                raise NotFoundException(detail="Cita no encontrada")
            if cita.updated_at != payload.expected_updated_at:
                raise DomainException(detail="La cita cambió. Recarga sus datos antes de guardar", status_code=409)
            if cita.estado == "cancelada":
                raise DomainException(detail="La cita está cancelada", status_code=409)
            before = self.snapshot(cita)
            if cancel:
                cita.estado, cita.motivo_cancelacion = "cancelada", payload.motivo
                action = "cancelada"
            else:
                await self._people(payload, asunto)
                if payload.tipo != cita.tipo and await self.citas.referenced_by_guide(cita):
                    raise DomainException(detail="La guía utiliza esta audiencia. Conserva su tipo", status_code=409)
                data = self._data(payload)
                action = "reprogramada" if (cita.inicio != data["inicio"] or cita.fin != data["fin"]) else "actualizada"
                for key, value in data.items():
                    setattr(cita, key, value)
            after = self.snapshot(cita)
            if before != after:
                self.citas.stage_change(cita, action, before, after, actor.id)
            return await self._finish(cita.id)
        except Exception:
            await self.session.rollback()
            raise

