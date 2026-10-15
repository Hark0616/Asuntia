"""Corrección de perfiles y expedientes: versiones, acceso, portal e integridad."""
import asyncio
import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asunto_paso import AsuntoPaso
from app.models.cliente import Cliente
from app.models.user import User
from app.api.v1.endpoints import auth as auth_endpoints

pytestmark = pytest.mark.asyncio
ABOGADO = "00000000-0000-0000-0000-000000000011"


async def nuevo_cliente(api, portal=True):
    suffix = uuid.uuid4().hex
    response = await api.post("/api/v1/clientes", json={
        "nombre": f"Cliente edición {suffix}", "numero_documento": f"DOC-{suffix}",
        "email": f"{suffix}@example.com", "telefono": "3001234567", "habilitar_portal": portal,
    })
    assert response.status_code == 201, response.text
    return response.json()


@pytest_asyncio.fixture
async def perfil(client):
    return await nuevo_cliente(client)


@pytest_asyncio.fixture
async def expediente(client, perfil):
    response = await client.post("/api/v1/asuntos", json={
        "titulo": f"Edición asunto {uuid.uuid4().hex}", "cliente_id": perfil["id"], "abogado_id": ABOGADO,
    })
    assert response.status_code == 201, response.text
    case = response.json()
    yield case
    assert (await client.delete(f"/api/v1/asuntos/{case['id']}")).status_code in {204, 404}


async def editar(api, perfil, **changes):
    return await api.patch(f"/api/v1/clientes/{perfil['id']}", json={
        "expected_updated_at": perfil["updated_at"], **changes,
    })


@pytest.mark.parametrize("auxiliar", [False, True])
async def test_oficina_corrige_perfil_sin_crear_otro_cliente(client, sandra_client, perfil, auxiliar):
    api = sandra_client if auxiliar else client
    response = await editar(api, perfil, nombre="  Nombre corregido  ", telefono=None,
                            direccion="Calle de prueba", observaciones="Dato revisado")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["id"] == perfil["id"] and body["portal_user_id"] == perfil["portal_user_id"]
    assert body["nombre"] == "Nombre corregido" and body["telefono"] is None
    assert body["updated_at"] != perfil["updated_at"]
    current = await api.get(f"/api/v1/clientes/{perfil['id']}")
    assert current.status_code == 200 and current.json()["direccion"] == "Calle de prueba"
    duplicate = await editar(api, perfil, nombre="Pantalla antigua")
    assert duplicate.status_code == 409
    assert (await api.get(f"/api/v1/clientes/{perfil['id']}")).json()["nombre"] == "Nombre corregido"


async def test_cambio_identidad_revoca_sesion_y_otp_y_usa_el_correo_corregido(
    client, anonymous_client, perfil, monkeypatch,
):
    delivered = []
    async def capture(email, code):
        delivered.append(email)
    monkeypatch.setattr(auth_endpoints, "send_otp_email", capture)
    async def request(document):
        return await anonymous_client.post("/api/v1/auth/otp/request", json={"firma_slug": "demo", "cedula": document})
    async def verify(document):
        return await anonymous_client.post("/api/v1/auth/otp/verify", json={"firma_slug": "demo", "cedula": document, "code": "12345"})
    await request(perfil["numero_documento"])
    assert (await verify(perfil["numero_documento"])).status_code == 200
    await request(perfil["numero_documento"])
    corrected_document = f"NUEVO-{uuid.uuid4().hex}"
    response = await editar(client, perfil, email="nuevo.correo@example.com", numero_documento=corrected_document)
    assert response.status_code == 200, response.text
    assert response.json()["portal_user_id"] == perfil["portal_user_id"]
    assert (await anonymous_client.get("/api/v1/auth/me")).status_code == 401
    assert (await verify(corrected_document)).status_code == 401
    assert (await verify(perfil["numero_documento"])).status_code == 401
    await request(corrected_document)
    assert delivered[-1] == "nuevo.correo@example.com"
    logged_in = await verify(corrected_document)
    assert logged_in.status_code == 200, logged_in.text
    assert logged_in.json()["user"]["id"] == perfil["portal_user_id"]
    assert logged_in.json()["user"]["email"] == "nuevo.correo@example.com"
    assert logged_in.json()["user"]["cedula"] == corrected_document


async def test_cambio_contacto_conserva_sesion_y_no_reactiva_portal(client, anonymous_client, perfil, db_session):
    await anonymous_client.post("/api/v1/auth/otp/request", json={"firma_slug": "demo", "cedula": perfil["numero_documento"]})
    assert (await anonymous_client.post("/api/v1/auth/otp/verify", json={
        "firma_slug": "demo", "cedula": perfil["numero_documento"], "code": "12345",
    })).status_code == 200
    response = await editar(client, perfil, nombre="Cliente corregido", telefono="3151112233")
    assert response.status_code == 200, response.text
    me = await anonymous_client.get("/api/v1/auth/me")
    assert me.status_code == 200 and me.json()["nombre"] == "Cliente corregido"
    identity = await db_session.get(User, uuid.UUID(perfil["portal_user_id"]))
    identity.is_active = False
    await db_session.commit()
    response = await editar(client, response.json(), telefono="3151112244")
    assert response.status_code == 200, response.text
    await db_session.refresh(identity)
    assert identity.is_active is False


async def test_edicion_sin_portal_no_crea_identidad(client):
    perfil = await nuevo_cliente(client, portal=False)
    response = await editar(client, perfil, email="corregido@example.com")
    assert response.status_code == 200
    assert response.json()["portal_user_id"] is None and not response.json()["portal_habilitado"]


async def test_correccion_de_formato_del_documento_no_cierra_sesion(client, anonymous_client, perfil):
    await anonymous_client.post("/api/v1/auth/otp/request", json={"firma_slug": "demo", "cedula": perfil["numero_documento"]})
    assert (await anonymous_client.post("/api/v1/auth/otp/verify", json={
        "firma_slug": "demo", "cedula": perfil["numero_documento"], "code": "12345",
    })).status_code == 200
    response = await editar(client, perfil, numero_documento=perfil["numero_documento"].replace("-", "."))
    assert response.status_code == 200, response.text
    assert (await anonymous_client.get("/api/v1/auth/me")).status_code == 200


async def test_perfil_corrupto_no_modifica_otra_identidad(client, perfil, db_session):
    stored = await db_session.get(Cliente, uuid.UUID(perfil["id"]))
    stored.portal_user_id = uuid.UUID("00000000-0000-0000-0000-000000000010")
    await db_session.commit()
    current = (await client.get(f"/api/v1/clientes/{perfil['id']}")).json()
    assert (await editar(client, current, email="no-guardar@example.com")).status_code == 409
    assert (await client.get(f"/api/v1/clientes/{perfil['id']}")).json()["email"] == perfil["email"]


@pytest.mark.parametrize("archivado", [False, True])
async def test_identificacion_duplicada_revierte_perfil_y_portal(client, perfil, db_session, archivado):
    other = await nuevo_cliente(client)
    if archivado:
        stored = await db_session.get(Cliente, uuid.UUID(other["id"]))
        stored.is_active = False
        await db_session.commit()
    response = await editar(client, perfil, numero_documento=other["numero_documento"], email="no-guardar@example.com")
    assert response.status_code == 409, response.text
    current = (await client.get(f"/api/v1/clientes/{perfil['id']}")).json()
    assert current["email"] == perfil["email"] and current["numero_documento"] == perfil["numero_documento"]
    user = await db_session.get(User, uuid.UUID(perfil["portal_user_id"]))
    await db_session.refresh(user)
    assert user.email == perfil["email"]


async def test_edicion_concurrente_de_cliente_devuelve_conflicto(client, perfil):
    responses = await asyncio.gather(editar(client, perfil, nombre="Primera edición"), editar(client, perfil, nombre="Segunda edición"))
    assert sorted(response.status_code for response in responses) == [200, 409]


@pytest.mark.parametrize("changes", [{"nombre": None}, {"nombre": "  "}, {"numero_documento": "..."},
    {"numero_documento": None}, {"email": None}, {"email": "inválido"}, {"telefono": "1" * 51},
    {"canal_preferido": None}, {"canal_preferido": "fax"}, {"fecha_expedicion": "no-fecha"},
    {"portal_user_id": str(uuid.uuid4())}, {"habilitar_portal": False}, {"firma_id": str(uuid.uuid4())}, {}])
async def test_cliente_rechaza_datos_invalidos(client, perfil, changes):
    assert (await editar(client, perfil, **changes)).status_code == 422


async def test_edicion_cliente_exige_version_y_permisos(client, perfil, alejandro_client, carlos_client, anonymous_client):
    path = f"/api/v1/clientes/{perfil['id']}"
    assert (await client.patch(path, json={"nombre": "Sin versión"})).status_code == 422
    assert (await client.patch(path, json={"expected_updated_at": "2026-10-15T12:00:00", "nombre": "Sin zona"})).status_code == 422
    for api, status in ((alejandro_client, 403), (carlos_client, 403), (anonymous_client, 401)):
        assert (await editar(api, perfil, nombre="No autorizado")).status_code == status
    assert (await carlos_client.get(path)).status_code == 403
    assert (await anonymous_client.get(path)).status_code == 401


@pytest.mark.parametrize("estado", ["inexistente", "otra_firma", "archivado"])
async def test_cliente_no_edita_referencias_fuera_de_alcance(client, perfil, db_session, estado):
    stored = await db_session.get(Cliente, uuid.UUID(perfil["id"]))
    if estado == "inexistente":
        perfil = {**perfil, "id": str(uuid.uuid4())}
    else:
        if estado == "otra_firma": stored.firma_id = uuid.uuid4()
        else: stored.is_active = False
        await db_session.commit()
    assert (await editar(client, perfil, nombre="No permitido")).status_code == 404
    assert (await client.get(f"/api/v1/clientes/{perfil['id']}")).status_code == 404


async def test_fallo_commit_no_deja_edicion_parcial(client, perfil, db_session, monkeypatch):
    async def broken_commit(self):
        raise RuntimeError("fallo de prueba")
    with monkeypatch.context() as patch:
        patch.setattr(AsyncSession, "commit", broken_commit)
        with pytest.raises(RuntimeError, match="fallo de prueba"):
            await editar(client, perfil, nombre="No conservar", email="tampoco@example.com")
    current = (await client.get(f"/api/v1/clientes/{perfil['id']}")).json()
    assert current["nombre"] == perfil["nombre"] and current["email"] == perfil["email"]
    identity = await db_session.get(User, uuid.UUID(perfil["portal_user_id"]))
    assert identity.nombre == perfil["nombre"] and identity.email == perfil["email"]


async def test_correccion_asunto_conserva_codigo_guia_y_cliente(client, alejandro_client, expediente):
    response = await alejandro_client.patch(f"/api/v1/asuntos/{expediente['id']}/datos", json={
        "expected_updated_at": expediente["updated_at"], "titulo": "  Contrato corregido  ",
        "radicado_oficial": "JUZ-CORREGIDO", "fecha_apertura": "2026-10-01",
    })
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["titulo"] == "Contrato corregido" and body["radicado_oficial"] == "JUZ-CORREGIDO"
    assert body["codigo_interno"] == expediente["codigo_interno"]
    assert body["cliente_id"] == expediente["cliente_id"] and body["ruta_codigo"] is None
    search = await client.get("/api/v1/asuntos/busqueda", params={"q": "JUZ-CORREGIDO"})
    assert expediente["id"] in {case["id"] for case in search.json()["items"]}
    clear = await client.patch(f"/api/v1/asuntos/{expediente['id']}/datos", json={
        "expected_updated_at": body["updated_at"], "radicado_oficial": None,
    })
    assert clear.status_code == 200 and clear.json()["radicado_oficial"] is None


async def test_edicion_asunto_concurrente_y_pantalla_obsoleta(client, expediente):
    async def change(title):
        return await client.patch(f"/api/v1/asuntos/{expediente['id']}/datos", json={
            "expected_updated_at": expediente["updated_at"], "titulo": title,
        })
    results = await asyncio.gather(change("Primera corrección"), change("Segunda corrección"))
    assert sorted(result.status_code for result in results) == [200, 409]


@pytest.mark.parametrize("estado", ["inexistente", "otra_firma", "archivado", "otro_responsable"])
async def test_asunto_no_edita_referencias_fuera_de_alcance(client, alejandro_client, expediente, db_session, estado):
    from app.models.asunto import Asunto
    case_id = expediente["id"]
    if estado == "inexistente":
        case_id = str(uuid.uuid4())
    elif estado == "archivado":
        assert (await client.delete(f"/api/v1/asuntos/{case_id}")).status_code == 204
    elif estado == "otro_responsable":
        assigned = await client.patch(f"/api/v1/asuntos/{case_id}/responsable", json={"responsable_id": "00000000-0000-0000-0000-000000000010"})
        assert assigned.status_code == 200
    else:
        stored = await db_session.get(Asunto, uuid.UUID(case_id))
        stored.firma_id = uuid.uuid4()
        await db_session.commit()
    api = alejandro_client if estado == "otro_responsable" else client
    response = await api.patch(f"/api/v1/asuntos/{case_id}/datos", json={
        "expected_updated_at": expediente["updated_at"], "titulo": "No autorizado",
    })
    assert response.status_code == 404


async def test_consulta_cliente_respeta_el_conteo_autorizado_del_abogado(client, alejandro_client, expediente):
    extra = await client.post("/api/v1/asuntos", json={"titulo": "Otro responsable", "cliente_id": expediente["cliente_id"]})
    assert extra.status_code == 201
    try:
        lawyer = await alejandro_client.get(f"/api/v1/clientes/{expediente['cliente_id']}")
        admin = await client.get(f"/api/v1/clientes/{expediente['cliente_id']}")
        assert lawyer.status_code == admin.status_code == 200
        assert lawyer.json()["asuntos_count"] == 1 and admin.json()["asuntos_count"] == 2
    finally:
        assert (await client.delete(f"/api/v1/asuntos/{extra.json()['id']}")).status_code == 204


@pytest.mark.parametrize("changes", [{"titulo": None}, {"titulo": " "}, {"radicado_oficial": ""},
    {"radicado_oficial": "x" * 101}, {"fecha_apertura": None}, {"codigo_interno": "CAMBIO"},
    {"cliente_id": str(uuid.uuid4())}, {"ruta_codigo": None}, {}])
async def test_asunto_rechaza_cambios_de_identidad_y_datos_invalidos(client, expediente, changes):
    response = await client.patch(f"/api/v1/asuntos/{expediente['id']}/datos", json={
        "expected_updated_at": expediente["updated_at"], **changes,
    })
    assert response.status_code == 422


async def test_asunto_rechaza_roles_y_padres_archivados(client, sandra_client, carlos_client, anonymous_client, expediente, db_session):
    body = {"expected_updated_at": expediente["updated_at"], "titulo": "No autorizado"}
    path = f"/api/v1/asuntos/{expediente['id']}/datos"
    for api, status in ((sandra_client, 403), (carlos_client, 403), (anonymous_client, 401)):
        assert (await api.patch(path, json=body)).status_code == status
    parent = await db_session.get(Cliente, uuid.UUID(expediente["cliente_id"]))
    parent.is_active = False
    await db_session.commit()
    assert (await client.patch(path, json=body)).status_code == 404


@pytest.mark.parametrize("completado", [False, True])
async def test_radicado_corrige_borradores_y_conserva_actuaciones_completadas(client, expediente, db_session, completado):
    guided = await client.post(f"/api/v1/asuntos/{expediente['id']}/guia", json={"ruta_codigo": "insolvencia_persona_natural:v2"})
    assert guided.status_code == 200
    step = await db_session.scalar(select(AsuntoPaso).where(AsuntoPaso.asunto_id == uuid.UUID(expediente["id"]), AsuntoPaso.codigo == "radicacion"))
    step.datos = {"radicado_oficial": "JUZ-ANTERIOR", "fecha_radicacion": "2026-10-01"}
    if completado: step.estado = "completado"
    await db_session.commit()
    response = await client.patch(f"/api/v1/asuntos/{expediente['id']}/datos", json={
        "expected_updated_at": guided.json()["updated_at"], "radicado_oficial": "JUZ-NUEVO",
    })
    assert response.status_code == 200, response.text
    await db_session.refresh(step)
    assert step.datos["radicado_oficial"] == ("JUZ-ANTERIOR" if completado else "JUZ-NUEVO")
    assert step.datos["fecha_radicacion"] == "2026-10-01"
