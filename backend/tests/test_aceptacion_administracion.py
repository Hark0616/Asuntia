"""Recorrido de jefatura: apertura, reparto de trabajo y archivo sin pérdida."""
import uuid

import pytest

from app.models.asunto import Asunto
from app.models.tarea import Tarea


ADMIN = "00000000-0000-0000-0000-000000000010"
ABOGADO = "00000000-0000-0000-0000-000000000011"
AUXILIAR = "00000000-0000-0000-0000-000000000012"


@pytest.mark.asyncio
async def test_jefatura_abre_distribuye_y_archiva_sin_perder_el_trabajo(
    client, alejandro_client, sandra_client, db_session,
):
    suffix = uuid.uuid4().hex
    title = f"Aceptación administración {suffix}"
    opened = await client.post("/api/v1/asuntos/apertura", json={
        "titulo": title,
        "radicado_oficial": "RAD-ACEPTACION-2026",
        "cliente_nuevo": {
            "nombre": f"Cliente de aceptación {suffix}",
            "numero_documento": suffix,
            "email": f"{suffix}@example.com",
            "habilitar_portal": False,
        },
    })
    assert opened.status_code == 201, opened.text
    case = opened.json()
    case_id = case["id"]
    assert case["abogado_id"] == ADMIN
    assert case["radicado_oficial"] == "RAD-ACEPTACION-2026"
    assert case["codigo_interno"] != case["radicado_oficial"]
    assert case["ruta_codigo"] is None

    search = await client.get("/api/v1/asuntos/busqueda", params={"q": title})
    assert search.status_code == 200, search.text
    assert search.json()["total"] == 1
    assert search.json()["items"][0]["id"] == case_id
    assert (await alejandro_client.get(f"/api/v1/asuntos/id/{case_id}")).status_code == 404

    tasks = []
    for responsible in (ADMIN, AUXILIAR, ADMIN):
        created = await client.post("/api/v1/tareas", json={
            "asunto_id": case_id,
            "titulo": "Revisar antecedentes controlados",
            "instruccion": "Comprobar el documento de aceptación del expediente.",
            "responsable_id": responsible,
            "vence_en": "2026-10-20T09:00:00-05:00",
        })
        assert created.status_code == 201, created.text
        tasks.append(created.json())
    completed = await client.patch(f"/api/v1/tareas/{tasks[2]['id']}", json={
        "expected_updated_at": tasks[2]["updated_at"], "estado": "completada",
    })
    assert completed.status_code == 200, completed.text
    task_ids = {task["id"] for task in tasks[:2]}

    team = await client.get("/api/v1/tareas/mi-trabajo", params={"alcance": "equipo", "limit": 100})
    assert team.status_code == 200, team.text
    assert task_ids <= {task["id"] for task in team.json()["items"]}

    assigned = await client.patch(f"/api/v1/asuntos/{case_id}/responsable", json={
        "responsable_id": ABOGADO,
    })
    assert assigned.status_code == 200, assigned.text
    assert assigned.json()["abogado_id"] == ABOGADO
    assert (await alejandro_client.get(f"/api/v1/asuntos/id/{case_id}")).status_code == 200

    lawyer_work = await alejandro_client.get("/api/v1/tareas/mi-trabajo", params={"limit": 100})
    assert lawyer_work.status_code == 200
    transferred = next(task for task in lawyer_work.json()["items"] if task["id"] == tasks[0]["id"])
    assert transferred["responsable"]["id"] == ABOGADO
    assistant_work = await sandra_client.get("/api/v1/tareas/mi-trabajo", params={"limit": 100})
    assert assistant_work.status_code == 200
    delegated = next(task for task in assistant_work.json()["items"] if task["id"] == tasks[1]["id"])
    assert delegated["responsable"]["id"] == AUXILIAR
    history = await client.get(f"/api/v1/tareas/asunto/{case_id}")
    assert history.status_code == 200, history.text
    preserved = next(task for task in history.json() if task["id"] == tasks[2]["id"])
    assert preserved["estado"] == "completada"
    assert preserved["responsable"]["id"] == ADMIN

    archived = await client.delete(f"/api/v1/asuntos/{case_id}")
    assert archived.status_code == 204, archived.text
    assert (await client.delete(f"/api/v1/asuntos/{case_id}")).status_code == 404
    assert (await alejandro_client.get(f"/api/v1/asuntos/id/{case_id}")).status_code == 404
    after_archive = await client.get("/api/v1/tareas/mi-trabajo", params={"alcance": "equipo", "limit": 100})
    assert after_archive.status_code == 200
    assert not task_ids & {task["id"] for task in after_archive.json()["items"]}
    assert (await client.get("/api/v1/asuntos/busqueda", params={"q": title})).json()["total"] == 0

    # La oficina deja de ofrecer el expediente, pero conserva las referencias.
    stored_case = await db_session.get(Asunto, uuid.UUID(case_id))
    assert stored_case is not None and stored_case.is_active is False
    for task in tasks:
        stored_task = await db_session.get(Tarea, uuid.UUID(task["id"]))
        assert stored_task is not None
        assert str(stored_task.asunto_id) == case_id
