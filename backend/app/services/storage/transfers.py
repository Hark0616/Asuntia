"""Temporales privados de operaciones; nunca contienen el original canónico cloud."""
import hashlib
import os
from pathlib import Path
import uuid

from starlette.concurrency import run_in_threadpool

from app.services.storage.local_storage import LocalStorageService


def transfer_path(firma_id: uuid.UUID, operation_id: uuid.UUID, part="input") -> Path:
    storage = LocalStorageService()
    return storage.contained_path(Path(".transfers") / firma_id.hex / operation_id.hex / part)


async def save_transfer(firma_id: uuid.UUID, operation_id: uuid.UUID, content: bytes, part="input"):
    target = transfer_path(firma_id, operation_id, part)

    def write():
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_name(f".{part}.{uuid.uuid4().hex}.part")
        try:
            descriptor = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_BINARY", 0), 0o600)
            with os.fdopen(descriptor, "wb") as stream:
                stream.write(content)
                stream.flush()
                os.fsync(stream.fileno())
            if target.exists() and hashlib.sha256(target.read_bytes()).digest() != hashlib.sha256(content).digest():
                raise ValueError("La operación ya contiene otro archivo")
            os.replace(temporary, target)
        finally:
            temporary.unlink(missing_ok=True)

    await run_in_threadpool(write)
    return target


async def clear_transfers(firma_id, operation_id):
    for part in ("input", "output"):
        await run_in_threadpool(transfer_path(firma_id, operation_id, part).unlink, missing_ok=True)
