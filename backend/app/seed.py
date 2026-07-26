import asyncio
import uuid
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
        print("Iniciando siembra de datos de prueba para Subfase 1...")

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

        # 3. Crear Catálogo de Estados Procesales
        estado_admitido = EstadoProcesal(
            id=uuid.UUID("00000000-0000-0000-0000-000000000101"),
            firma_id=DEFAULT_FIRMA_ID,
            nombre="Admitido en Centro de Conciliación",
            descripcion="Solicitud formalmente admitida",
            color_tipo="mint",
            orden=1
        )
        estado_requiere = EstadoProcesal(
            id=uuid.UUID("00000000-0000-0000-0000-000000000102"),
            firma_id=DEFAULT_FIRMA_ID,
            nombre="Requiere cliente",
            descripcion="Pendiente soporte del deudor",
            color_tipo="warning",
            orden=2
        )
        session.add_all([estado_admitido, estado_requiere])

        # 4. Crear Asunto de Insolvencia
        asunto_insolvencia = Asunto(
            id=uuid.UUID("00000000-0000-0000-0000-000000000201"),
            firma_id=DEFAULT_FIRMA_ID,
            radicado="AS-2026-001",
            cliente_id=cliente_carlos.id,
            abogado_id=abogada.id,
            estado_id=estado_admitido.id,
            etapa_actual="Etapa 2: Negociación de Pasivos",
            siguiente_paso="Fijación de fecha para primera audiencia de negociación"
        )
        session.add(asunto_insolvencia)

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
            titulo="Nota interna: Verificación de acreencia Bancolombia",
            descripcion="Borrador de conciliación de extractos bancarios antes de la audiencia.",
            publicado_al_cliente=False,
            created_by_id=abogada.id
        )
        session.add_all([novedad1, novedad2])

        await session.commit()
        print("Siembra de datos completada exitosamente.")

if __name__ == "__main__":
    asyncio.run(seed_data())
