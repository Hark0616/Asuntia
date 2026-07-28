import asyncio
import uuid
from sqlalchemy import delete
from app.core.db import AsyncSessionLocal
from app.models.firma import Firma
from app.models.user import User
from app.models.estado import EstadoProcesal
from app.models.asunto import Asunto
from app.models.novedad import Novedad
from app.models.documento import DocumentoAsunto
from app.models.firma_storage import FirmaStorageConfig
from app.models.auth_challenge import AuthChallenge
from app.models.asunto_paso import AsuntoPaso
from app.core.security import get_password_hash
from app.services.workflow_service import initial_workflow_steps

DEFAULT_FIRMA_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

async def seed_data():
    async with AsyncSessionLocal() as session:
        print("Iniciando siembra de datos realistas para el equipo de Asuntia Legal...")

        # Limpiar datos previos en orden inverso de claves foráneas
        await session.execute(delete(AuthChallenge))
        await session.execute(delete(DocumentoAsunto))
        await session.execute(delete(FirmaStorageConfig))
        await session.execute(delete(Novedad))
        await session.execute(delete(AsuntoPaso))
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

        # 2. Crear Usuarios (Abogados y Clientes Reales)
        abogada_daniela = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000010"),
            firma_id=DEFAULT_FIRMA_ID,
            nombre="Dra. Daniela Torres",
            email="daniela.torres@asuntia.com",
            hashed_password=get_password_hash("admin123"),
            cedula="52.840.192",
            rol="administrador"
        )
        abogado_alejandro = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000011"),
            firma_id=DEFAULT_FIRMA_ID,
            nombre="Dr. Alejandro Morales",
            email="alejandro.morales@asuntia.com",
            hashed_password=get_password_hash("admin123"),
            cedula="79.382.910",
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
        cliente_transportes = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000030"),
            firma_id=DEFAULT_FIRMA_ID,
            nombre="Transportes del Norte S.A.S. (Laura Mejía)",
            email="gerencia@transportesnorte.co",
            cedula="901.482.910-5",
            rol="cliente"
        )
        cliente_elena = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000040"),
            firma_id=DEFAULT_FIRMA_ID,
            nombre="Dra. María Elena Villamizar",
            email="elena.villamizar@gmail.com",
            cedula="52.391.804",
            rol="cliente"
        )
        cliente_jorge = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000050"),
            firma_id=DEFAULT_FIRMA_ID,
            nombre="Jorge Eliécer Bermúdez",
            email="jorge.bermudez@outlook.com",
            cedula="79.482.105",
            rol="cliente"
        )

        session.add_all([abogada_daniela, abogado_alejandro, cliente_carlos, cliente_transportes, cliente_elena, cliente_jorge])

        # 3. Catálogo Oficial de 10 Estados Procesales
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
                descripcion="Listo para radicación ante el Centro de Conciliación o Juzgado",
                color_tipo="purple",
                orden=5
            ),
            EstadoProcesal(
                id=uuid.UUID("00000000-0000-0000-0000-000000000106"),
                firma_id=DEFAULT_FIRMA_ID,
                nombre="Presentado",
                descripcion="Solicitud o demanda formalmente radicada",
                color_tipo="blue",
                orden=6
            ),
            EstadoProcesal(
                id=uuid.UUID("00000000-0000-0000-0000-000000000107"),
                firma_id=DEFAULT_FIRMA_ID,
                nombre="En espera de respuesta",
                descripcion="En traslado o auto de admisión del despacho o conciliador",
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
                descripcion="Negociación o trámite procesal en desarrollo",
                color_tipo="mint",
                orden=9
            ),
            EstadoProcesal(
                id=uuid.UUID("00000000-0000-0000-0000-000000000110"),
                firma_id=DEFAULT_FIRMA_ID,
                nombre="Cerrado / Archivado",
                descripcion="Acuerdo logrado o proceso finalizado",
                color_tipo="neutral",
                orden=10
            )
        ]
        session.add_all(estados)

        # 4. Crear Asuntos Variados
        asunto1 = Asunto(
            id=uuid.UUID("00000000-0000-0000-0000-000000000201"),
            firma_id=DEFAULT_FIRMA_ID,
            radicado="AS-2026-001",
            cliente_id=cliente_carlos.id,
            abogado_id=abogada_daniela.id,
            estado_id=estados[0].id,
            etapa_actual="Paso 1 de 5: Radicación",
            siguiente_paso=initial_workflow_steps()[0]["descripcion"],
            created_by_id=abogada_daniela.id,
        )
        asunto2 = Asunto(
            id=uuid.UUID("00000000-0000-0000-0000-000000000202"),
            firma_id=DEFAULT_FIRMA_ID,
            radicado="AS-2026-002",
            cliente_id=cliente_transportes.id,
            abogado_id=abogado_alejandro.id,
            estado_id=estados[0].id,
            etapa_actual="Paso 1 de 5: Radicación",
            siguiente_paso=initial_workflow_steps()[0]["descripcion"],
            created_by_id=abogado_alejandro.id,
        )
        asunto3 = Asunto(
            id=uuid.UUID("00000000-0000-0000-0000-000000000203"),
            firma_id=DEFAULT_FIRMA_ID,
            radicado="AS-2026-003",
            cliente_id=cliente_elena.id,
            abogado_id=abogada_daniela.id,
            estado_id=estados[0].id,
            etapa_actual="Paso 1 de 5: Radicación",
            siguiente_paso=initial_workflow_steps()[0]["descripcion"],
            created_by_id=abogada_daniela.id,
        )
        asunto4 = Asunto(
            id=uuid.UUID("00000000-0000-0000-0000-000000000204"),
            firma_id=DEFAULT_FIRMA_ID,
            radicado="AS-2026-004",
            cliente_id=cliente_jorge.id,
            abogado_id=abogado_alejandro.id,
            estado_id=estados[0].id,
            etapa_actual="Paso 1 de 5: Radicación",
            siguiente_paso=initial_workflow_steps()[0]["descripcion"],
            created_by_id=abogado_alejandro.id,
        )

        session.add_all([asunto1, asunto2, asunto3, asunto4])
        session.add_all(
            [
                AsuntoPaso(
                    **step,
                    asunto_id=asunto.id,
                    firma_id=DEFAULT_FIRMA_ID,
                    created_by_id=asunto.abogado_id,
                )
                for asunto in (asunto1, asunto2, asunto3, asunto4)
                for step in initial_workflow_steps()
            ]
        )

        # 5. Crear Novedades Procesales
        novedades = [
            Novedad(
                id=uuid.UUID("00000000-0000-0000-0000-000000000301"),
                firma_id=DEFAULT_FIRMA_ID,
                asunto_id=asunto1.id,
                titulo="Auto de Admisión Expedido",
                descripcion="El Centro de Conciliación admitió la solicitud de negociación de pasivos de acuerdo con la Ley de Insolvencia.",
                publicado_al_cliente=True,
                created_by_id=abogada_daniela.id
            ),
            Novedad(
                id=uuid.UUID("00000000-0000-0000-0000-000000000302"),
                firma_id=DEFAULT_FIRMA_ID,
                asunto_id=asunto1.id,
                titulo="Verificación interna de acreencias",
                descripcion="Revisión de saldos reportados con Bancolombia y Davivienda por el equipo legal.",
                publicado_al_cliente=False,
                created_by_id=abogada_daniela.id
            )
        ]
        session.add_all(novedades)

        await session.commit()
        print("Siembra de datos realistas para Asuntia Legal completada exitosamente.")

if __name__ == "__main__":
    asyncio.run(seed_data())
