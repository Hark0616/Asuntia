import sys
import asyncio
import uuid
from sqlalchemy import select
from app.core.db import AsyncSessionLocal
from app.models.firma import Firma
from app.models.user import User
from app.models.estado import EstadoProcesal
from app.models.asunto import Asunto
from app.models.novedad import Novedad
from app.models.documento import DocumentoAsunto
from app.services.storage import storage_service

# Forzar salida segura en consola de Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

DEFAULT_FIRMA_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

async def run_step_by_step_simulation():
    async with AsyncSessionLocal() as session:
        print("=========================================================================")
        print("   SIMULACIÓN PASO A PASO DEL FLUJO SEGÚN SCOPE_v1.md (INSOLVENCIA)")
        print("=========================================================================\n")

        # Obtener abogada y cliente Carlos Gómez
        abogada_res = await session.execute(select(User).where(User.rol == "abogado"))
        abogada = abogada_res.scalars().first()

        cliente_res = await session.execute(select(User).where(User.cedula == "1.094.852.140"))
        cliente = cliente_res.scalars().first()

        estados_res = await session.execute(select(EstadoProcesal).where(EstadoProcesal.firma_id == DEFAULT_FIRMA_ID).order_by(EstadoProcesal.orden))
        estados = list(estados_res.scalars().all())
        estado_map = {e.nombre: e for e in estados}

        print(f"👤 Cliente: {cliente.nombre} (CC: {cliente.cedula})")
        print(f"Abogada a cargo: {abogada.nombre}\n")

        # PASO 1: RADICAR EL CASO
        print("--- PASO 1: RADICACIÓN E INICIO DEL EXPEDIENTE ---")
        asunto_radicado = "AS-2026-INSOLVENCIA-REAL"
        
        # Verificar si ya existe este radicado para reutilizarlo
        existing_res = await session.execute(select(Asunto).where(Asunto.radicado == asunto_radicado))
        asunto = existing_res.scalars().first()

        if not asunto:
            asunto_id = uuid.uuid4()
            asunto = Asunto(
                id=asunto_id,
                firma_id=DEFAULT_FIRMA_ID,
                radicado=asunto_radicado,
                cliente_id=cliente.id,
                abogado_id=abogada.id,
                estado_id=estado_map["Sin acción aún"].id,
                etapa_actual="Paso 1: Apertura y Radicación",
                siguiente_paso="Recepción de anexos e insumos (desprendibles, certificados laboral y bancario)"
            )
            session.add(asunto)
        else:
            asunto_id = asunto.id
            asunto.estado_id = estado_map["Sin acción aún"].id
            asunto.etapa_actual = "Paso 1: Apertura y Radicación"
            asunto.siguiente_paso = "Recepción de anexos e insumos (desprendibles, certificados laboral y bancario)"

        nov1 = Novedad(
            id=uuid.uuid4(),
            firma_id=DEFAULT_FIRMA_ID,
            asunto_id=asunto_id,
            titulo="Expediente Registrado",
            descripcion="Se dio apertura formal al trámite de insolvencia de persona natural de acuerdo a la Ley 2445.",
            publicado_al_cliente=True,
            created_by_id=abogada.id
        )
        session.add(nov1)
        await session.commit()

        print(f"✅ [OFICINA] Caso registrado en PostgreSQL con radicado {asunto.radicado}")
        print(f"👁️ [LO QUE VE EL CLIENTE AL INGRESAR A SU PORTAL]:")
        print(f"   • Estado Procesal: {estado_map['Sin acción aún'].nombre}")
        print(f"   • Próximo paso: {asunto.siguiente_paso}")
        print(f"   • Novedad pública: '{nov1.descripcion}'\n")

        # PASO 2: RECEPCIÓN DE ANEXOS Y SUBIDA EN GOOGLE DRIVE
        print("--- PASO 2: CONSTRUCCIÓN DE SOLICITUD Y SUBIDA DE ANEXOS A GOOGLE DRIVE ---")
        asunto.estado_id = estado_map["Pendiente por presentar"].id
        asunto.etapa_actual = "Paso 2: Elaboración de Escrito de Solicitud"
        asunto.siguiente_paso = "Firma del escrito de solicitud y radicación ante el Centro de Conciliación"

        doc1_id, doc1_view, doc1_down, size1 = await storage_service.upload_file(
            file_bytes=b"Contenido del certificado laboral y de ingresos de Carlos Gomez",
            filename="Certificado_Ingresos_CarlosGomez.pdf",
            mime_type="application/pdf"
        )
        
        doc1 = DocumentoAsunto(
            id=uuid.uuid4(),
            firma_id=DEFAULT_FIRMA_ID,
            asunto_id=asunto_id,
            nombre_funcional="Certificado Laboral e Ingresos",
            tipo_documental="anexo",
            provider="google_drive",
            external_file_id=doc1_id,
            web_view_url=doc1_view,
            web_download_url=doc1_down,
            mime_type="application/pdf",
            tamano_bytes=size1,
            compartido_con_cliente=True
        )
        session.add(doc1)

        nov2 = Novedad(
            id=uuid.uuid4(),
            firma_id=DEFAULT_FIRMA_ID,
            asunto_id=asunto_id,
            titulo="Anexos en Google Drive",
            descripcion="Se incorporó la relación de acreedores y certificado laboral al expediente de Google Drive.",
            publicado_al_cliente=True,
            created_by_id=abogada.id
        )
        session.add(nov2)
        await session.commit()

        print(f"✅ [OFICINA] Subido documento a Google Drive: {doc1.nombre_funcional}")
        print(f"👁️ [LO QUE VE EL CLIENTE AL INGRESAR A SU PORTAL]:")
        print(f"   • Estado Procesal: {estado_map['Pendiente por presentar'].nombre}")
        print(f"   • Documento compartido en Google Drive: {doc1.nombre_funcional} ({doc1.web_view_url})")
        print(f"   • Novedades timeline: 2 avances publicados\n")

        # PASO 3: PRESENTACIÓN Y ADMISIÓN
        print("--- PASO 3: PRESENTACIÓN ANTE CENTRO DE CONCILIACIÓN Y ADMISIÓN ---")
        asunto.estado_id = estado_map["Admitido en Centro de Conciliación"].id
        asunto.etapa_actual = "Paso 3: Auto Admisorio Expedido"
        asunto.siguiente_paso = "Fijación de fecha y hora para la Audiencia de Negociación de Pasivos"

        doc2_id, doc2_view, doc2_down, size2 = await storage_service.upload_file(
            file_bytes=b"Contenido del Auto Admisorio del Centro de Conciliacion",
            filename="Auto_Admisorio_Conciliacion.pdf",
            mime_type="application/pdf"
        )
        
        doc2 = DocumentoAsunto(
            id=uuid.uuid4(),
            firma_id=DEFAULT_FIRMA_ID,
            asunto_id=asunto_id,
            nombre_funcional="Auto Admisorio del Centro de Conciliación",
            tipo_documental="auto_admisorio",
            provider="google_drive",
            external_file_id=doc2_id,
            web_view_url=doc2_view,
            web_download_url=doc2_down,
            mime_type="application/pdf",
            tamano_bytes=size2,
            compartido_con_cliente=True
        )
        session.add(doc2)

        nov3 = Novedad(
            id=uuid.uuid4(),
            firma_id=DEFAULT_FIRMA_ID,
            asunto_id=asunto_id,
            titulo="¡Solicitud Admitida!",
            descripcion="El Centro de Conciliación de la Cámara de Comercio expidió el auto admisorio formal.",
            publicado_al_cliente=True,
            created_by_id=abogada.id
        )
        session.add(nov3)
        await session.commit()

        print(f"✅ [OFICINA] Estado cambiado a 'Admitido en Centro de Conciliación'")
        print(f"👁️ [LO QUE VE EL CLIENTE AL INGRESAR A SU PORTAL]:")
        print(f"   • Estado Badge: {estado_map['Admitido en Centro de Conciliación'].nombre} (BADGE VERDE/MINT)")
        print(f"   • Documentos visibles en Drive: 2 (Certificado Ingresos + Auto Admisorio)")
        print(f"   • Novedad pública: '{nov3.descripcion}'\n")

        # PASO 4: AUDIENCIA Y RESULTADO (ACUERDO VS FRACASO)
        print("--- PASO 4: AUDIENCIA DE NEGOCIACIÓN DE PASIVOS ---")
        asunto.estado_id = estado_map["Activo en audiencia"].id
        asunto.etapa_actual = "Paso 4: Audiencia de Negociación de Acreedores"
        asunto.siguiente_paso = "Celebración de audiencia con bancos acreedores"

        nov4 = Novedad(
            id=uuid.uuid4(),
            firma_id=DEFAULT_FIRMA_ID,
            asunto_id=asunto_id,
            titulo="Audiencia Agendada",
            descripcion="Se citó a audiencia de negociación para el día 15 de agosto a las 09:00 a.m. con acreedores.",
            publicado_al_cliente=True,
            created_by_id=abogada.id
        )
        session.add(nov4)
        await session.commit()

        print(f"✅ [OFICINA] Audiencia en curso.")
        print(f"👁️ [LO QUE VE EL CLIENTE AL INGRESAR A SU PORTAL]:")
        print(f"   • Estado Procesal: {estado_map['Activo en audiencia'].nombre}")
        print(f"   • Próximo paso: {asunto.siguiente_paso}\n")

        # PASO 5: DEFINICIÓN FINAL (FRACASO -> PASO A LIQUIDACIÓN PATRIMONIAL ANTE JUZGADO)
        print("--- PASO 5: DEFINICIÓN DE AUDIENCIA (FRACASO) Y PASE A LIQUIDACIÓN PATRIMONIAL ---")
        asunto.estado_id = estado_map["Pendiente por corregir"].id
        asunto.etapa_actual = "Paso 5: Acta de Fracaso expedida - Remisión a Liquidación Patrimonial"
        asunto.siguiente_paso = "Reparto de demanda de liquidación patrimonial en juzgados civiles del circuito"

        doc3_id, doc3_view, doc3_down, size3 = await storage_service.upload_file(
            file_bytes=b"Contenido del Acta de Fracaso de Conciliacion",
            filename="Acta_Fracaso_Conciliacion.pdf",
            mime_type="application/pdf"
        )
        
        doc3 = DocumentoAsunto(
            id=uuid.uuid4(),
            firma_id=DEFAULT_FIRMA_ID,
            asunto_id=asunto_id,
            nombre_funcional="Acta de Fracaso de Conciliación",
            tipo_documental="acta_audiencia",
            provider="google_drive",
            external_file_id=doc3_id,
            web_view_url=doc3_view,
            web_download_url=doc3_down,
            mime_type="application/pdf",
            tamano_bytes=size3,
            compartido_con_cliente=True
        )
        session.add(doc3)

        nov5 = Novedad(
            id=uuid.uuid4(),
            firma_id=DEFAULT_FIRMA_ID,
            asunto_id=asunto_id,
            titulo="Acta de Fracaso Expedida",
            descripcion="Al no lograr acuerdo de quita con la totalidad de acreedores, se expidió Acta de Fracaso y se remite el caso a Liquidación Judicial ante el Juzgado.",
            publicado_al_cliente=True,
            created_by_id=abogada.id
        )
        session.add(nov5)
        await session.commit()

        print(f"✅ [OFICINA] Proceso remitido a Liquidación Judicial ante el Juzgado.")
        print(f"👁️ [LO QUE VE EL CLIENTE AL INGRESAR A SU PORTAL]:")
        print(f"   • Etapa Actual: {asunto.etapa_actual}")
        print(f"   • Próximo paso: {asunto.siguiente_paso}")
        print(f"   • Documentos compartidos en Google Drive: 3")
        print(f"   • Total Novedades en Timeline: 5 avances publicados\n")

        print("=========================================================================")
        print("   ¡SIMULACIÓN COMPLETA EXITOSA! EL FLUJO DE SCOPE_v1.MD SE EJECUTÓ 100%")
        print("=========================================================================")

if __name__ == "__main__":
    asyncio.run(run_step_by_step_simulation())
