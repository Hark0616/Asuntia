import pytest
import uuid

@pytest.mark.asyncio
async def test_list_documentos_asunto_empty(client):
    """
    Prueba listar los documentos de un asunto que aún no tiene documentos registrados.
    """
    asunto_id = "00000000-0000-0000-0000-000000000201"
    response = await client.get(f"/api/v1/asuntos/{asunto_id}/documentos")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_upload_and_preview_real_local_pdf(client):
    asunto_id = "00000000-0000-0000-0000-000000000201"
    pdf_content = b"%PDF-1.4\n% Asuntia test document\n%%EOF"

    upload = await client.post(
        f"/api/v1/asuntos/{asunto_id}/documentos/upload",
        data={
            "nombre_funcional": "Soporte real local",
            "tipo_documental": "anexo",
            "subcarpeta": "anexo",
            "compartido_con_cliente": "true",
        },
        files={"file": ("soporte.pdf", pdf_content, "application/pdf")},
    )

    assert upload.status_code == 201
    document = upload.json()
    assert document["provider"] == "local"
    assert document["tamano_bytes"] == len(pdf_content)

    preview = await client.get(f"/api/v1/documentos/{document['id']}/preview")
    assert preview.status_code == 200
    assert preview.headers["content-type"] == "application/pdf"
    assert preview.content == pdf_content

@pytest.mark.asyncio
async def test_vincular_y_toggle_visibilidad_documento(client):
    """
    Prueba vincular un documento externo de Google Drive y alternar su visibilidad para el cliente.
    """
    asunto_id = "00000000-0000-0000-0000-000000000201"
    payload = {
        "nombre_funcional": "Auto Admisorio de Negociación Ley 2445",
        "tipo_documental": "auto_admisorio",
        "external_file_id": f"gdrive_file_{uuid.uuid4().hex[:8]}",
        "web_view_url": "https://drive.google.com/file/d/test_id/view",
        "web_download_url": "https://drive.google.com/uc?id=test_id&export=download",
        "mime_type": "application/pdf",
        "tamano_bytes": 1048576,
        "compartido_con_cliente": False
    }

    # 1. Vincular Documento
    res_link = await client.post(f"/api/v1/asuntos/{asunto_id}/documentos/vincular", json=payload)
    assert res_link.status_code == 201
    doc_data = res_link.json()
    assert doc_data["nombre_funcional"] == payload["nombre_funcional"]
    assert doc_data["compartido_con_cliente"] is False
    doc_id = doc_data["id"]

    # 2. Verificar que en la lista de sólo compartidos (portal cliente) NO aparece aún
    res_cliente_list = await client.get(f"/api/v1/asuntos/{asunto_id}/documentos?solo_compartidos=true")
    assert res_cliente_list.status_code == 200
    ids_compartidos = [d["id"] for d in res_cliente_list.json()]
    assert doc_id not in ids_compartidos

    # 3. Alternar visibilidad a Compartido = True
    res_toggle = await client.patch(f"/api/v1/documentos/{doc_id}/visibilidad?compartido=true")
    assert res_toggle.status_code == 200
    assert res_toggle.json()["compartido_con_cliente"] is True

    # 4. Confirmar que ahora SÍ aparece en la consulta del cliente
    res_cliente_list2 = await client.get(f"/api/v1/asuntos/{asunto_id}/documentos?solo_compartidos=true")
    ids_compartidos2 = [d["id"] for d in res_cliente_list2.json()]
    assert doc_id in ids_compartidos2

@pytest.mark.asyncio
async def test_vincular_documento_asunto_not_found(client):
    """
    [CASO BORDE / ERROR 404] Intentar vincular un documento a un asunto inexistente.
    """
    random_uuid = str(uuid.uuid4())
    payload = {
        "nombre_funcional": "Documento Fantasma",
        "external_file_id": "none",
        "web_view_url": "https://drive.google.com/none"
    }
    response = await client.post(f"/api/v1/asuntos/{random_uuid}/documentos/vincular", json=payload)
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_toggle_visibilidad_not_found(client):
    """
    [CASO BORDE / ERROR 404] Intentar cambiar la visibilidad de un documento que no existe.
    """
    random_uuid = str(uuid.uuid4())
    response = await client.patch(f"/api/v1/documentos/{random_uuid}/visibilidad?compartido=true")
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_delete_documento_soft_delete(client):
    """
    [SOFT DELETE] Vincular un documento y realizar borrado lógico.
    """
    asunto_id = "00000000-0000-0000-0000-000000000201"
    payload = {
        "nombre_funcional": "Borrador Temporal para Eliminar",
        "external_file_id": f"del_{uuid.uuid4().hex[:6]}",
        "web_view_url": "https://drive.google.com/del"
    }
    res_create = await client.post(f"/api/v1/asuntos/{asunto_id}/documentos/vincular", json=payload)
    doc_id = res_create.json()["id"]

    # Eliminar
    res_del = await client.delete(f"/api/v1/documentos/{doc_id}")
    assert res_del.status_code == 204

    # Verificar que al listar ya no aparece
    res_list = await client.get(f"/api/v1/asuntos/{asunto_id}/documentos")
    ids_activos = [d["id"] for d in res_list.json()]
    assert doc_id not in ids_activos
