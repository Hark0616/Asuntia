import httpx
import pytest

from app.services.storage.onedrive import OneDriveStorageService, StorageError


async def test_adapter_follows_download_without_forwarding_graph_bearer():
    seen = []
    def handle(request):
        seen.append((request.url.host, request.headers.get("authorization")))
        if request.url.host == "graph.microsoft.com":
            return httpx.Response(302, headers={"location": "https://example.files.1drv.com/content?tempauth=synthetic"})
        return httpx.Response(200, content=b"%PDF-1.4\n%%EOF")
    provider = OneDriveStorageService("synthetic-bearer", "drive", transport=httpx.MockTransport(handle))
    try:
        assert await provider.read_content("id") == b"%PDF-1.4\n%%EOF"
    finally:
        await provider.close()
    assert seen == [("graph.microsoft.com", "Bearer synthetic-bearer"), ("example.files.1drv.com", None)]


@pytest.mark.parametrize("url", ["http://example.files.1drv.com/content", "https://attacker.test/file", "https://127.0.0.1/file", "https://files.1drv.com.attacker.test/file", "https://user:pass@example.files.1drv.com/file"])
async def test_adapter_refuses_unsafe_download_redirects(url):
    provider = OneDriveStorageService("bearer", "drive", transport=httpx.MockTransport(
        lambda request: httpx.Response(302, headers={"location": url})))
    try:
        with pytest.raises(StorageError) as caught:
            await provider.read_content("id")
        assert caught.value.code == "download_host"
    finally:
        await provider.close()


async def test_adapter_limits_content_even_when_provider_reports_smaller_size(monkeypatch):
    monkeypatch.setattr("app.services.storage.onedrive.MAX_DOCUMENT_BYTES", 10)
    provider = OneDriveStorageService("bearer", "drive", transport=httpx.MockTransport(
        lambda request: httpx.Response(200, content=b"x" * 11)))
    try:
        with pytest.raises(StorageError) as caught:
            await provider.read_content("id")
        assert caught.value.code == "size"
    finally:
        await provider.close()


@pytest.mark.parametrize("status,code,retry", [(401, "reconnect", False), (403, "reconnect", False), (404, "missing", False),
    (412, "conflict", False), (429, "provider", True), (503, "provider", True)])
async def test_provider_errors_are_sanitized_and_have_bounded_retry_policy(status, code, retry):
    provider = OneDriveStorageService("bearer", "drive", transport=httpx.MockTransport(
        lambda request: httpx.Response(status, json={"error": {"message": "remote-secret-token"}})))
    try:
        with pytest.raises(StorageError) as caught:
            await provider.get_file_metadata("id")
        assert caught.value.code == code and caught.value.retryable is retry
        assert "remote-secret-token" not in caught.value.message
    finally:
        await provider.close()


async def test_metadata_rejects_shared_shortcuts_and_outside_folder():
    def handle(request):
        id = request.url.path.split("/")[-1]
        if id == "shortcut":
            return httpx.Response(200, json={"id": id, "remoteItem": {}})
        return httpx.Response(200, json={"id": id, "folder": {}})
    provider = OneDriveStorageService("bearer", "drive", transport=httpx.MockTransport(handle))
    try:
        with pytest.raises(StorageError) as caught:
            await provider.get_file_metadata("shortcut")
        assert caught.value.code == "unsupported"
        with pytest.raises(StorageError) as caught:
            await provider.require_descendant({"id": "foreign", "parentReference": {"driveId": "another-drive", "id": "parent"}}, "root")
        assert caught.value.code == "outside_folder"
    finally:
        await provider.close()


async def test_pagination_never_requests_a_client_supplied_external_host():
    requested = []
    provider = OneDriveStorageService("bearer", "drive", transport=httpx.MockTransport(
        lambda request: requested.append(request) or httpx.Response(200, json={})))
    try:
        with pytest.raises(StorageError):
            await provider.list_children("folder", "https://attacker.test/next")
        with pytest.raises(StorageError):
            await provider.list_children("folder", "https://graph.microsoft.com/v1.0/me/messages")
        assert requested == []
    finally:
        await provider.close()


async def test_pagination_accepts_equivalent_encoding_of_personal_drive_item_id():
    requested = []
    provider = OneDriveStorageService("bearer", "drive", transport=httpx.MockTransport(
        lambda request: requested.append(request) or httpx.Response(200, json={"value": []})))
    try:
        page = await provider.list_children("ABC!123", "https://graph.microsoft.com/v1.0/drives/drive/items/ABC!123/children?$skiptoken=opaque")
        assert page == {"value": []} and len(requested) == 1
    finally:
        await provider.close()
