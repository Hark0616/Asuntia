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
from app.core.security import get_password_hash

DEFAULT_FIRMA_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

async def seed_data():
    async with AsyncSessionLocal() as session:
        print("Iniciando siembra de datos realistas para el equipo de Asuntia Legal...")

        # Limpiar datos previos en orden inverso de claves foráneas
        await session.execute(delete(DocumentoAsunto))
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

        # 2. Crear Usuarios (Abogados y Clientes Reales)
        abogada_daniela = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000010"),
            firma_id=DEFAULT_FIRMA_ID,
            nombre="Dra. Daniela Torres",
            email="daniela.torres@asuntia.com",
            hashed_password=get_password_hash("admin123"),
            cedula="52.840.192",
            rol="abogado"
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
            estado_id=estados[7].id, # Admitido en Centro de Conciliación
            etapa_actual="Etapa 2: Negociación de Pasivos",
            siguiente_paso="Fijación de fecha para primera audiencia de negociación de acreedores"
        )
        asunto2 = Asunto(
            id=uuid.UUID("00000000-0000-0000-0000-000000000202"),
            firma_id=DEFAULT_FIRMA_ID,
            radicado="AS-2026-002",
            cliente_id=cliente_transportes.id,
            abogado_id=abogado_alejandro.id,
            estado_id=estados[8].id, # Activo en audiencia
            etapa_actual="Etapa 3: Calificación y Graduación de Créditos",
            siguiente_paso="Presentación del inventario de activos y pasivos ante la Supersociedades"
        )
        asunto3 = Asunto(
            id=uuid.UUID("00000000-0000-0000-0000-000000000203"),
            firma_id=DEFAULT_FIRMA_ID,
            radicado="AS-2026-003",
            cliente_id=cliente_elena.id,
            abogado_id=abogada_daniela.id,
            estado_id=estados[2].id, # Pendiente por corregir
            etapa_actual="Etapa 1: Subsanación de Demanda",
            siguiente_paso="Anexo de certificado médico actualizado para subsanar auto inadmitorio"
        )
        asunto4 = Asunto(
            id=uuid.UUID("00000000-0000-0000-0000-000000000204"),
            firma_id=DEFAULT_FIRMA_ID,
            radicado="AS-2026-004",
            cliente_id=cliente_jorge.id,
            abogado_id=abogado_alejandro.id,
            estado_id=estados[6].id, # En espera de respuesta
            etapa_actual="Etapa 2: Medidas Cautelares y Embargos",
            siguiente_paso="Respuesta del oficio de embargo preventivo de productos bancarios"
        )

        session.add_all([asunto1, asunto2, asunto3, asunto4])

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

        # 6. Crear Documentos en Google Drive para el Asunto AS-2026-001
        documentos = [
            DocumentoAsunto(
                id=uuid.UUID("00000000-0000-0000-0000-000000000401"),
                firma_id=DEFAULT_FIRMA_ID,
                asunto_id=asunto1.id,
                nombre_funcional="Certificado Laboral e Ingresos",
                tipo_documental="anexo",
                provider="google_drive",
                external_file_id="gdrive_cert_carlos_001",
                web_view_url="https://drive.google.com/file/d/gdrive_cert_carlos_001/view",
                web_download_url="https://drive.google.com/uc?id=gdrive_cert_carlos_001&export=download",
                mime_type="application/pdf",
                tamano_bytes=1048576,
                compartido_con_cliente=True,
                estado_revision="recibido",
                created_by_id=abogada_daniela.id
            ),
            DocumentoAsunto(
                id=uuid.UUID("00000000-0000-0000-0000-000000000402"),
                firma_id=DEFAULT_FIRMA_ID,
                asunto_id=asunto1.id,
                nombre_funcional="Auto Admisorio del Centro de Conciliación",
                tipo_documental="auto_admisorio",
                provider="google_drive",
                external_file_id="gdrive_auto_admisorio_001",
                web_view_url="https://drive.google.com/file/d/gdrive_auto_admisorio_001/view",
                web_download_url="https://drive.google.com/uc?id=gdrive_auto_admisorio_001&export=download",
                mime_type="application/pdf",
                tamano_bytes=2097152,
                compartido_con_cliente=True,
                estado_revision="recibido",
                created_by_id=abogada_daniela.id
            ),
            DocumentoAsunto(
                id=uuid.UUID("00000000-0000-0000-0000-000000000403"),
                firma_id=DEFAULT_FIRMA_ID,
                asunto_id=asunto1.id,
                nombre_funcional="Borrador Reservado de Estrategia con Bancos",
                tipo_documental="otro",
                provider="google_drive",
                external_file_id="gdrive_estrategia_interna_001",
                web_view_url="https://drive.google.com/file/d/gdrive_estrategia_interna_001/view",
                web_download_url="https://drive.google.com/uc?id=gdrive_estrategia_interna_001&export=download",
                mime_type="application/pdf",
                tamano_bytes=524288,
                compartido_con_cliente=False,
                estado_revision="recibido",
                created_by_id=abogada_daniela.id
            )
        ]
        session.add_all(documentos)

        await session.commit()
        print("Siembra de datos realistas para Asuntia Legal completada exitosamente.")

if __name__ == "__main__":
    asyncio.run(seed_data())
