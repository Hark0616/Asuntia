import asyncio
import uuid
from sqlalchemy import delete
from app.core.db import AsyncSessionLocal
from app.models.firma import Firma
from app.models.user import User
from app.models.estado import EstadoProcesal
from app.models.asunto import Asunto
from app.models.novedad import Novedad
from app.core.security import get_password_hash

DEFAULT_FIRMA_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

async def seed_data():
    async with AsyncSessionLocal() as session:
        print("Iniciando siembra del catálogo completo de 10 estados y datos para Subfase 1...")

        # Limpiar datos previos en orden inverso de claves foráneas
        await session.execute(delete(Novedad))
        await session.execute(delete(Asunto))
        await session.execute(delete(EstadoProcesal))
        await session.execute(delete(User))
        await session.execute(delete(Firma))
        await session.commit()

        # 1. Crear Firma Principal
        firma = Firma(
            id=DEFAULT_FIRMA_ID,
            nombre="Asuntia Legal S.A.S.",
            subdominio="demo",
            is_active=True
        )
        session.add(firma)

        # 2. Crear Usuarios (Abogada de la firma y Clientes)
        abogada = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000010"),
            firma_id=DEFAULT_FIRMA_ID,
            nombre="Dra. Daniela Torres",
            email="daniela.torres@asuntia.com",
            hashed_password=get_password_hash("admin123"),
            cedula="52.840.192",
            rol="abogado"
        )
        cliente_carlos = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000020"),
            firma_id=DEFAULT_FIRMA_ID,
            nombre="Carlos Gómez Restrepo",
            email="carlos.gomez@email.com",
            cedula="1.094.852.140",
            rol="cliente"
        )
        cliente_norte = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000030"),
            firma_id=DEFAULT_FIRMA_ID,
            nombre="Constructora Norte S.A.S. (Laura Mejía)",
            email="laura@constructoranorte.co",
            cedula="900.542.118-4",
            rol="cliente"
        )
        session.add_all([abogada, cliente_carlos, cliente_norte])

        # 3. Crear Catálogo Oficial de los 10 Estados Procesales
        estados = [
            EstadoProcesal(
                id=uuid.UUID("00000000-0000-0000-0000-000000000101"),
                firma_id=DEFAULT_FIRMA_ID,
                nombre="Sin acción aún",
                descripcion="Expediente recién abierto sin actuaciones iniciales",
                color_tipo="warning",
                orden=1
            ),
            EstadoProcesal(
                id=uuid.UUID("00000000-0000-0000-0000-000000000102"),
                firma_id=DEFAULT_FIRMA_ID,
                nombre="Pendiente por hacer",
                descripcion="Tareas u observaciones pendientes por la firma",
                color_tipo="warning",
                orden=2
            ),
            EstadoProcesal(
                id=uuid.UUID("00000000-0000-0000-0000-000000000103"),
                firma_id=DEFAULT_FIRMA_ID,
                nombre="Pendiente por corregir",
                descripcion="Revisión de subsanaciones solicitadas por el juzgado o conciliador",
                color_tipo="danger",
                orden=3
            ),
            EstadoProcesal(
                id=uuid.UUID("00000000-0000-0000-0000-000000000104"),
                firma_id=DEFAULT_FIRMA_ID,
                nombre="Listo pero no se puede presentar",
                descripcion="Documentación completa en espera de apertura de términos",
                color_tipo="warning",
                orden=4
            ),
            EstadoProcesal(
                id=uuid.UUID("00000000-0000-0000-0000-000000000105"),
                firma_id=DEFAULT_FIRMA_ID,
                nombre="Pendiente por presentar",
                descripcion="Listo para radicación ante el Centro de Conciliación",
                color_tipo="purple",
                orden=5
            ),
            EstadoProcesal(
                id=uuid.UUID("00000000-0000-0000-0000-000000000106"),
                firma_id=DEFAULT_FIRMA_ID,
                nombre="Presentado",
                descripcion="Solicitud formalmente radicada",
                color_tipo="blue",
                orden=6
            ),
            EstadoProcesal(
                id=uuid.UUID("00000000-0000-0000-0000-000000000107"),
                firma_id=DEFAULT_FIRMA_ID,
                nombre="En espera de respuesta",
                descripcion="En traslado o auto de admisión del conciliador",
                color_tipo="cyan",
                orden=7
            ),
            EstadoProcesal(
                id=uuid.UUID("00000000-0000-0000-0000-000000000108"),
                firma_id=DEFAULT_FIRMA_ID,
                nombre="Admitido en Centro de Conciliación",
                descripcion="Auto admisorio notificado",
                color_tipo="mint",
                orden=8
            ),
            EstadoProcesal(
                id=uuid.UUID("00000000-0000-0000-0000-000000000109"),
                firma_id=DEFAULT_FIRMA_ID,
                nombre="Activo en audiencia",
                descripcion="Negociación de pasivos en desarrollo",
                color_tipo="mint",
                orden=9
            ),
            EstadoProcesal(
                id=uuid.UUID("00000000-0000-0000-0000-000000000110"),
                firma_id=DEFAULT_FIRMA_ID,
                nombre="Cerrado / Archivado",
                descripcion="Acuerdo logrado o liquidación concluida",
                color_tipo="neutral",
                orden=10
            )
        ]
        session.add_all(estados)

        # 4. Crear Asuntos de Prueba
        asunto_insolvencia = Asunto(
            id=uuid.UUID("00000000-0000-0000-0000-000000000201"),
            firma_id=DEFAULT_FIRMA_ID,
            radicado="AS-2026-001",
            cliente_id=cliente_carlos.id,
            abogado_id=abogada.id,
            estado_id=estados[7].id, # Admitido
            etapa_actual="Etapa 2: Negociación de Pasivos",
            siguiente_paso="Fijación de fecha para primera audiencia de negociación"
        )
        asunto_licitacion = Asunto(
            id=uuid.UUID("00000000-0000-0000-0000-000000000202"),
            firma_id=DEFAULT_FIRMA_ID,
            radicado="AS-2026-002",
            cliente_id=cliente_norte.id,
            abogado_id=abogada.id,
            estado_id=estados[1].id, # Pendiente por hacer
            etapa_actual="Etapa 1: Evaluación de Pliegos",
            siguiente_paso="Recibir certificado de experiencia actualizado en PDF"
        )
        session.add_all([asunto_insolvencia, asunto_licitacion])

        # 5. Crear Novedades Procesales
        novedad1 = Novedad(
            id=uuid.UUID("00000000-0000-0000-0000-000000000301"),
            firma_id=DEFAULT_FIRMA_ID,
            asunto_id=asunto_insolvencia.id,
            titulo="Auto de Admisión Expedido",
            descripcion="El Centro de Conciliación admitió formalmente la solicitud de negociación de pasivos de acuerdo con la Ley 2445.",
            publicado_al_cliente=True,
            created_by_id=abogada.id
        )
        novedad2 = Novedad(
            id=uuid.UUID("00000000-0000-0000-0000-000000000302"),
            firma_id=DEFAULT_FIRMA_ID,
            asunto_id=asunto_insolvencia.id,
            titulo="Verificación de acreencia Bancolombia",
            descripcion="Borrador de conciliación de extractos bancarios antes de la audiencia.",
            publicado_al_cliente=False,
            created_by_id=abogada.id
        )
        session.add_all([novedad1, novedad2])

        await session.commit()
        print("Siembra del catálogo completo de 10 estados completada exitosamente.")

if __name__ == "__main__":
    asyncio.run(seed_data())
