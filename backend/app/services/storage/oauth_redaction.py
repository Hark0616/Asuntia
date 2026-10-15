from urllib.parse import parse_qs


class StorageOAuthRedactionMiddleware:
    """Retira código/state del scope que Uvicorn escribe en su access log."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope.get("path") == "/api/v1/storage/onedrive/callback":
            values = parse_qs(scope.get("query_string", b"").decode("ascii", errors="replace"))
            scope.setdefault("state", {})["storage_oauth"] = {
                key: value[0] for key, value in values.items() if len(value) == 1 and len(value[0]) <= 8192
            }
            scope["query_string"] = b""
        await self.app(scope, receive, send)
