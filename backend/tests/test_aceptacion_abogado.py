"""Recorridos API del abogado con datos sintéticos y almacenamiento local temporal.

Estas pruebas integran permisos y módulos; no sustituyen aceptación humana ni
una comprobación del despliegue de producción.
"""

import uuid

import pytest
import pytest_asyncio


ADMIN = "00000000-0000-0000-0000-000000000010"
ABOGADO = "00000000-0000-0000-0000-000000000011"
CLIENTE = "00000000-0000-0000-0000-000000000020"
PDF = b"%PDF-1.4\n% Recorrido abogado: documento sintetico\n%%EOF"


@pytest_asyncio.fixture
async def expediente_abogado(client, alejandro_client):
    response = await alejandro_client.post(
        "/api/v1/asuntos",
        json={"titulo": f"Aceptación abogado {uuid.uuid4().hex}", "cliente_id": CLIENTE},
    )
    assert response.status_code == 201, response.text
    expediente = response.json()
    assert expediente["abogado_id"] == ABOGADO
    yield expediente
    archived = await client.delete(f"/api/v1/asuntos/{expediente['id']}")
    assert archived.status_code in {204, 404}, archived.text


async def subir_pdf(api, expediente, **extra):
    return await api.post(
        f"/api/v1/asuntos/{expediente['id']}/documentos/upload",
        data={
            "nombre_funcional": "Soporte para revisión",
            "tipo_documental": "anexo",
            "operation_id": str(uuid.uuid4()),
            **extra,
        },
        files={"file": ("soporte.pdf", PDF, "application/pdf")},
    )


async def crear_tarea(api, expediente):
    response = await api.post(
        "/api/v1/tareas",
        json={
            "asunto_id": expediente["id"], "titulo": "Revisar soporte de aceptación",
            "instruccion": "Verificar el soporte antes de comunicar al cliente.",
            "responsable_id": ABOGADO, "vence_en": "2099-06-15T09:00:00-05:00",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_abogado_opera_expediente_y_controla_lo_que_recibe_cliente(
    expediente_abogado, alejandro_client, carlos_client,
):
    """Alta propia → trabajo → soporte y nota → autorización → retirada."""
    expediente = expediente_abogado
    case_id = expediente["id"]
    encontrados = await alejandro_client.get(
        "/api/v1/asuntos/busqueda", params={"q": expediente["titulo"]},
    )
    assert encontrados.status_code == 200, encontrados.text
    assert [item["id"] for item in encontrados.json()["items"]] == [case_id]
    detalle = await alejandro_client.get(f"/api/v1/asuntos/id/{case_id}")
    assert detalle.status_code == 200
    assert detalle.json()["ruta_codigo"] is None

    tarea = await crear_tarea(alejandro_client, expediente)
    trabajo = await alejandro_client.get("/api/v1/tareas/mi-trabajo", params={"limit": 100})
    assert trabajo.status_code == 200
    assert tarea["id"] in {item["id"] for item in trabajo.json()["items"]}
    agenda = await alejandro_client.get(
        "/api/v1/tareas/agenda",
        params={"desde": "2099-06-15T00:00:00Z", "hasta": "2099-06-16T00:00:00Z"},
    )
    assert agenda.status_code == 200, agenda.text
    assert any(item["asunto"]["id"] == case_id for item in agenda.json()["items"])
    for estado in ("en_progreso", "completada"):
        changed = await alejandro_client.patch(
            f"/api/v1/tareas/{tarea['id']}",
            json={"expected_updated_at": tarea["updated_at"], "estado": estado},
        )
        assert changed.status_code == 200, changed.text
        tarea = changed.json()
    trabajo = await alejandro_client.get("/api/v1/tareas/mi-trabajo", params={"limit": 100})
    assert tarea["id"] not in {item["id"] for item in trabajo.json()["items"]}

    nota = await alejandro_client.post(
        f"/api/v1/novedades/asunto/{case_id}",
        json={"titulo": "Soporte revisado", "descripcion": "Revisión interna del expediente."},
    )
    assert nota.status_code == 201, nota.text
    assert nota.json()["publicado_al_cliente"] is False
    uploaded = await subir_pdf(alejandro_client, expediente)
    assert uploaded.status_code == 201, uploaded.text
    documento = uploaded.json()
    assert documento["provider"] == "local"
    assert documento["compartido_con_cliente"] is False
    preview_path = f"/api/v1/documentos/{documento['id']}/preview"
    preview = await alejandro_client.get(preview_path)
    assert preview.status_code == 200 and preview.content == PDF
    assert (await carlos_client.get(preview_path)).status_code == 404
    assert (await carlos_client.get(f"/api/v1/novedades/asunto/{case_id}")).json() == []
    assert (await carlos_client.get(f"/api/v1/asuntos/{case_id}/documentos")).json() == []

    note_path = f"/api/v1/novedades/{nota.json()['id']}/visibilidad"
    doc_path = f"/api/v1/documentos/{documento['id']}/visibilidad"
    assert (await alejandro_client.patch(note_path, json={"publicado_al_cliente": True})).status_code == 200
    assert (await alejandro_client.patch(doc_path, params={"compartido": "true"})).status_code == 200
    preview = await carlos_client.get(preview_path)
    assert preview.status_code == 200 and preview.content == PDF
    assert preview.headers["cache-control"] == "private, no-store"
    historia = await carlos_client.get(f"/api/v1/novedades/asunto/{case_id}")
    assert historia.status_code == 200
    eventos = [item for item in historia.json() if item["tipo"] == "documento_incorporado"]
    assert len(eventos) == 1
    assert {item["id"] for item in historia.json()} == {nota.json()["id"], eventos[0]["id"]}

    assert (await alejandro_client.patch(note_path, json={"publicado_al_cliente": False})).status_code == 200
    assert (await alejandro_client.patch(doc_path, params={"compartido": "false"})).status_code == 200
    assert (await carlos_client.get(preview_path)).status_code == 404
    assert (await carlos_client.get(f"/api/v1/novedades/asunto/{case_id}")).json() == []
    interno = await alejandro_client.get(f"/api/v1/novedades/asunto/{case_id}")
    assert {item["id"] for item in interno.json()} == {nota.json()["id"], eventos[0]["id"]}
    # El trabajo y la publicación no añaden una guía ni alteran el caso general.
    final = await alejandro_client.get(f"/api/v1/asuntos/id/{case_id}")
    assert final.json()["ruta_codigo"] is None and final.json()["pasos"] == []


@pytest.mark.asyncio
async def test_abogado_captura_borrador_y_avanza_guia_sin_publicacion_implicita(
    expediente_abogado, alejandro_client, carlos_client,
):
    case_id = expediente_abogado["id"]
    attached = await alejandro_client.post(
        f"/api/v1/asuntos/{case_id}/guia", json={"ruta_codigo": "insolvencia_persona_natural:v2"},
    )
    assert attached.status_code == 200, attached.text
    paso = attached.json()["pasos"][0]
    draft = await alejandro_client.patch(
        f"/api/v1/asuntos/{case_id}/flujo/borrador",
        json={"paso_codigo": paso["codigo"], "expected_updated_at": paso["updated_at"],
              "datos": {"observaciones": "Información recibida; revisión por completar."}},
    )
    assert draft.status_code == 200, draft.text
    paso = draft.json()["pasos"][0]
    assert paso["estado"] == "activo" and paso["completed_at"] is None
    invalid = await alejandro_client.post(
        f"/api/v1/asuntos/{case_id}/flujo/avanzar",
        json={"paso_codigo": paso["codigo"], "expected_updated_at": paso["updated_at"], "datos": {}},
    )
    assert invalid.status_code == 400, invalid.text
    advanced = await alejandro_client.post(
        f"/api/v1/asuntos/{case_id}/flujo/avanzar",
        json={"paso_codigo": paso["codigo"], "expected_updated_at": paso["updated_at"],
              "datos": {"identidad_verificada": True, "viabilidad_preliminar": "viable"}},
    )
    assert advanced.status_code == 200, advanced.text
    detail = advanced.json()
    assert detail["paso_actual"] == 2
    assert detail["pasos"][0]["datos"]["observaciones"] == paso["datos"]["observaciones"]
    assert detail["pasos"][0]["completed_by_id"] == ABOGADO
    assert detail["pasos"][1]["estado"] == "activo"
    tareas = await alejandro_client.get(f"/api/v1/tareas/asunto/{case_id}")
    assert tareas.status_code == 200
    assert sum(item["estado"] == "completada" for item in tareas.json()) == 1
    assert sum(item["estado"] == "pendiente" for item in tareas.json()) == 1
    assert (await carlos_client.get(f"/api/v1/novedades/asunto/{case_id}")).json() == []
    assert (await alejandro_client.post(
        f"/api/v1/asuntos/{case_id}/guia", json={"ruta_codigo": "insolvencia_persona_natural:v2"},
    )).status_code == 409


@pytest.mark.asyncio
async def test_transferencia_revoca_acceso_del_abogado_en_todos_los_modulos(
    expediente_abogado, client, alejandro_client,
):
    expediente = expediente_abogado
    case_id = expediente["id"]
    tarea = await crear_tarea(alejandro_client, expediente)
    nota = await alejandro_client.post(
        f"/api/v1/novedades/asunto/{case_id}",
        json={"titulo": "Pendiente previo al traspaso", "descripcion": "Nota sintética."},
    )
    assert nota.status_code == 201
    uploaded = await subir_pdf(alejandro_client, expediente)
    assert uploaded.status_code == 201, uploaded.text
    doc_id = uploaded.json()["id"]
    transferred = await client.patch(
        f"/api/v1/asuntos/{case_id}/responsable", json={"responsable_id": ADMIN},
    )
    assert transferred.status_code == 200, transferred.text
    for path in (
        f"/api/v1/asuntos/id/{case_id}",
        f"/api/v1/asuntos/{expediente['radicado']}",
        f"/api/v1/tareas/asunto/{case_id}",
        f"/api/v1/novedades/asunto/{case_id}",
        f"/api/v1/asuntos/{case_id}/documentos",
        f"/api/v1/documentos/{doc_id}/preview",
    ):
        blocked = await alejandro_client.get(path)
        assert blocked.status_code == 404, (path, blocked.text)
    assert (await alejandro_client.patch(
        f"/api/v1/tareas/{tarea['id']}",
        json={"expected_updated_at": tarea["updated_at"], "estado": "completada"},
    )).status_code == 404
    assert (await alejandro_client.patch(
        f"/api/v1/novedades/{nota.json()['id']}/visibilidad", json={"publicado_al_cliente": True},
    )).status_code == 404
    assert (await alejandro_client.patch(
        f"/api/v1/documentos/{doc_id}/visibilidad", params={"compartido": "true"},
    )).status_code == 404
    assert (await subir_pdf(alejandro_client, expediente)).status_code == 404
    search = await alejandro_client.get("/api/v1/asuntos/busqueda", params={"q": expediente["titulo"]})
    assert search.status_code == 200 and search.json()["total"] == 0
    mine = await alejandro_client.get("/api/v1/tareas/mi-trabajo", params={"limit": 100})
    assert all(item["asunto"]["id"] != case_id for item in mine.json()["items"])
    # El traspaso conserva el documento y mueve el trabajo abierto al nuevo responsable.
    assert (await client.get(f"/api/v1/documentos/{doc_id}/preview")).content == PDF
    current_tasks = await client.get(f"/api/v1/tareas/asunto/{case_id}")
    current = next(item for item in current_tasks.json() if item["id"] == tarea["id"])
    assert current["responsable"]["id"] == ADMIN and current["estado"] == "pendiente"


@pytest.mark.asyncio
async def test_abogado_respeta_limites_administrativos_y_validacion(
    expediente_abogado, alejandro_client, anonymous_client,
):
    case_id = expediente_abogado["id"]
    assert (await alejandro_client.delete(f"/api/v1/asuntos/{case_id}")).status_code == 403
    assert (await alejandro_client.patch(
        f"/api/v1/asuntos/{case_id}/responsable", json={"responsable_id": ADMIN},
    )).status_code == 403
    for path in ("/api/v1/tareas/mi-trabajo", "/api/v1/tareas/agenda"):
        assert (await alejandro_client.get(path, params={"alcance": "equipo"})).status_code == 403
    assert (await anonymous_client.get(f"/api/v1/asuntos/id/{case_id}")).status_code == 401
    invalid = await alejandro_client.post(
        "/api/v1/tareas", json={"asunto_id": case_id, "titulo": " ", "instruccion": "Revisar.",
                                "responsable_id": ABOGADO},
    )
    assert invalid.status_code == 422
    assert (await alejandro_client.patch(
        f"/api/v1/asuntos/{case_id}/estado", json={"estado_id": str(uuid.uuid4())},
    )).status_code == 404
    assert (await alejandro_client.delete(f"/api/v1/novedades/{uuid.uuid4()}")).status_code == 404
    assert (await alejandro_client.delete(f"/api/v1/documentos/{uuid.uuid4()}")).status_code == 404
