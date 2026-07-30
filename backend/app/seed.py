import asyncio
import uuid
from sqlalchemy import delete
from app.core.db import AsyncSessionLocal
from app.models.firma import Firma
from app.models.user import User
from app.models.cliente import Cliente
from app.models.estado import EstadoProcesal
from app.models.asunto import Asunto
from app.models.novedad import Novedad
from app.models.documento import DocumentoAsunto
from app.models.firma_storage import FirmaStorageConfig
from app.models.auth_challenge import AuthChallenge
from app.models.asunto_paso import AsuntoPaso
from app.models.tarea import Tarea, TareaEstado, TareaPrioridad, TareaTipo
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
        await session.execute(delete(Tarea))
        await session.execute(delete(AsuntoPaso))
        await session.execute(delete(Asunto))
        await session.execute(delete(Cliente))
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
        auxiliar_sandra = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000012"),
            firma_id=DEFAULT_FIRMA_ID,
            nombre="Sandra Pérez",
            email="sandra.perez@asuntia.com",
            hashed_password=get_password_hash("admin123"),
            cedula="63.482.105",
            rol="auxiliar"
        )

        portal_carlos = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000020"),
            firma_id=DEFAULT_FIRMA_ID,
            nombre="Carlos Gómez Restrepo",
            email="carlos.gomez@email.com",
            cedula="1.094.852.140",
            rol="cliente"
        )
        portal_transportes = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000030"),
            firma_id=DEFAULT_FIRMA_ID,
            nombre="Transportes del Norte S.A.S. (Laura Mejía)",
            email="gerencia@transportesnorte.co",
            cedula="901.482.910-5",
            rol="cliente"
        )
        portal_elena = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000040"),
            firma_id=DEFAULT_FIRMA_ID,
            nombre="Dra. María Elena Villamizar",
            email="elena.villamizar@gmail.com",
            cedula="52.391.804",
            rol="cliente"
        )
        portal_jorge = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000050"),
            firma_id=DEFAULT_FIRMA_ID,
            nombre="Jorge Eliécer Bermúdez",
            email="jorge.bermudez@outlook.com",
            cedula="79.482.105",
            rol="cliente"
        )

        session.add_all([
            abogada_daniela,
            abogado_alejandro,
            auxiliar_sandra,
            portal_carlos,
            portal_transportes,
            portal_elena,
            portal_jorge,
        ])

        # El perfil del cliente es permanente y separado de su acceso al portal.
        cliente_carlos = Cliente(
            id=portal_carlos.id,
            firma_id=DEFAULT_FIRMA_ID,
            nombre=portal_carlos.nombre,
            tipo_persona="natural",
            tipo_documento="CC",
            numero_documento=portal_carlos.cedula,
            numero_documento_normalizado="1094852140",
            email=portal_carlos.email,
            telefono="300 482 1940",
            ciudad="Bucaramanga",
            departamento="Santander",
            canal_preferido="whatsapp",
            portal_user_id=portal_carlos.id,
            responsable_id=abogada_daniela.id,
            created_by_id=abogada_daniela.id,
        )
        cliente_transportes = Cliente(
            id=portal_transportes.id,
            firma_id=DEFAULT_FIRMA_ID,
            nombre=portal_transportes.nombre,
            tipo_persona="juridica",
            tipo_documento="NIT",
            numero_documento=portal_transportes.cedula,
            numero_documento_normalizado="9014829105",
            email=portal_transportes.email,
            telefono="607 642 1830",
            direccion="Zona Industrial Chimitá",
            ciudad="Girón",
            departamento="Santander",
            canal_preferido="email",
            portal_user_id=portal_transportes.id,
            responsable_id=abogado_alejandro.id,
            created_by_id=abogado_alejandro.id,
        )
        cliente_elena = Cliente(
            id=portal_elena.id,
            firma_id=DEFAULT_FIRMA_ID,
            nombre=portal_elena.nombre,
            tipo_persona="natural",
            tipo_documento="CC",
            numero_documento=portal_elena.cedula,
            numero_documento_normalizado="52391804",
            email=portal_elena.email,
            telefono="315 391 8040",
            ciudad="Bucaramanga",
            departamento="Santander",
            canal_preferido="email",
            portal_user_id=portal_elena.id,
            responsable_id=abogada_daniela.id,
            created_by_id=abogada_daniela.id,
        )
        cliente_jorge = Cliente(
            id=portal_jorge.id,
            firma_id=DEFAULT_FIRMA_ID,
            nombre=portal_jorge.nombre,
            tipo_persona="natural",
            tipo_documento="CC",
            numero_documento=portal_jorge.cedula,
            numero_documento_normalizado="79482105",
            email=portal_jorge.email,
            telefono="310 482 1050",
            ciudad="Floridablanca",
            departamento="Santander",
            canal_preferido="whatsapp",
            portal_user_id=portal_jorge.id,
            responsable_id=abogado_alejandro.id,
            created_by_id=abogado_alejandro.id,
        )
        session.add_all([
            cliente_carlos,
            cliente_transportes,
            cliente_elena,
            cliente_jorge,
        ])

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
            etapa_actual=f"Paso 1 de {len(initial_workflow_steps())}: {initial_workflow_steps()[0]['titulo']}",
            siguiente_paso=initial_workflow_steps()[0]["descripcion"],
            ruta_codigo="insolvencia_persona_natural:v2",
            created_by_id=abogada_daniela.id,
        )
        asunto2 = Asunto(
            id=uuid.UUID("00000000-0000-0000-0000-000000000202"),
            firma_id=DEFAULT_FIRMA_ID,
            radicado="AS-2026-002",
            cliente_id=cliente_transportes.id,
            abogado_id=abogado_alejandro.id,
            estado_id=estados[0].id,
            etapa_actual=f"Paso 1 de {len(initial_workflow_steps())}: {initial_workflow_steps()[0]['titulo']}",
            siguiente_paso=initial_workflow_steps()[0]["descripcion"],
            ruta_codigo="insolvencia_persona_natural:v2",
            created_by_id=abogado_alejandro.id,
        )
        asunto3 = Asunto(
            id=uuid.UUID("00000000-0000-0000-0000-000000000203"),
            firma_id=DEFAULT_FIRMA_ID,
            radicado="AS-2026-003",
            cliente_id=cliente_elena.id,
            abogado_id=abogada_daniela.id,
            estado_id=estados[0].id,
            etapa_actual=f"Paso 1 de {len(initial_workflow_steps())}: {initial_workflow_steps()[0]['titulo']}",
            siguiente_paso=initial_workflow_steps()[0]["descripcion"],
            ruta_codigo="insolvencia_persona_natural:v2",
            created_by_id=abogada_daniela.id,
        )
        asunto4 = Asunto(
            id=uuid.UUID("00000000-0000-0000-0000-000000000204"),
            firma_id=DEFAULT_FIRMA_ID,
            radicado="AS-2026-004",
            cliente_id=cliente_jorge.id,
            abogado_id=abogado_alejandro.id,
            estado_id=estados[0].id,
            etapa_actual=f"Paso 1 de {len(initial_workflow_steps())}: {initial_workflow_steps()[0]['titulo']}",
            siguiente_paso=initial_workflow_steps()[0]["descripcion"],
            ruta_codigo="insolvencia_persona_natural:v2",
            created_by_id=abogado_alejandro.id,
        )

        session.add_all([asunto1, asunto2, asunto3, asunto4])
        pasos_por_asunto: dict[uuid.UUID, list[AsuntoPaso]] = {}
        for asunto in (asunto1, asunto2, asunto3, asunto4):
            pasos = [
                AsuntoPaso(
                    **step,
                    asunto_id=asunto.id,
                    firma_id=DEFAULT_FIRMA_ID,
                    created_by_id=asunto.abogado_id,
                )
                for step in initial_workflow_steps()
            ]
            pasos_por_asunto[asunto.id] = pasos
            session.add_all(pasos)
        await session.flush()

        for asunto in (asunto1, asunto2, asunto3, asunto4):
            primer_paso = pasos_por_asunto[asunto.id][0]
            session.add(
                Tarea(
                    firma_id=DEFAULT_FIRMA_ID,
                    asunto_id=asunto.id,
                    asunto_paso_id=primer_paso.id,
                    codigo=f"paso:{primer_paso.codigo}",
                    tipo=TareaTipo.COMPLETAR_PASO.value,
                    titulo=f"Completar {primer_paso.titulo.lower()}",
                    instruccion=primer_paso.descripcion,
                    estado=TareaEstado.PENDIENTE.value,
                    prioridad=TareaPrioridad.NORMAL.value,
                    responsable_id=asunto.abogado_id,
                    solicitante_id=asunto.created_by_id,
                    created_by_id=asunto.created_by_id,
                )
            )

        # 5. Crear Novedades Procesales
        novedades = [
            Novedad(
                id=uuid.UUID("00000000-0000-0000-0000-000000000301"),
                firma_id=DEFAULT_FIRMA_ID,
                asunto_id=asunto1.id,
                titulo="Documentos iniciales solicitados",
                descripcion="El equipo jurídico inició la recepción del asunto y solicitó la información necesaria para evaluar la solicitud.",
                publicado_al_cliente=True,
                created_by_id=abogada_daniela.id
            ),
            Novedad(
                id=uuid.UUID("00000000-0000-0000-0000-000000000302"),
                firma_id=DEFAULT_FIRMA_ID,
                asunto_id=asunto1.id,
                titulo="Revisión inicial del asunto",
                descripcion="Validación interna de identidad, documentos disponibles y posibles conflictos antes de emitir una conclusión.",
                publicado_al_cliente=False,
                created_by_id=abogada_daniela.id
            )
        ]
        session.add_all(novedades)

        await session.commit()
        print("Siembra de datos realistas para Asuntia Legal completada exitosamente.")

if __name__ == "__main__":
    asyncio.run(seed_data())
