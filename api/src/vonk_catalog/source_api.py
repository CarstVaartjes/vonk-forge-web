from __future__ import annotations

import tempfile
from dataclasses import asdict
from datetime import UTC, datetime

from fastapi import APIRouter, Request

from .auth import AuthServices, require_csrf, require_session
from .models import SourceBundle
from .problems import Problem
from .publishers import PublisherService
from .source_bundles import BundleLimits, SourceBundleError, SourceBundleStore


def build_source_router(services: AuthServices, store: SourceBundleStore) -> APIRouter:
    router = APIRouter(prefix="/v1")

    @router.put("/publishers/{publisher}/source-bundles/{sha256}")
    async def upload_source_bundle(
        publisher: str, sha256: str, request: Request
    ) -> dict[str, object]:
        authenticated = require_session(request, services)
        require_csrf(request, services)
        media_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
        if media_type not in {
            "application/x-tar",
            "application/vnd.vonk.source-bundle.v1+tar",
        }:
            raise Problem(
                415,
                "bundle.content_type_invalid",
                "Source bundle media type is invalid",
                "Upload a canonical tar source bundle.",
            )
        maximum = BundleLimits().max_archive_bytes
        received = 0
        with tempfile.SpooledTemporaryFile(max_size=1024 * 1024, mode="w+b") as payload:
            async for chunk in request.stream():
                received += len(chunk)
                if received > maximum:
                    raise Problem(
                        413,
                        "bundle.archive_too_large",
                        "Source bundle is too large",
                        "Keep the source archive at or below 64 MiB.",
                    )
                payload.write(chunk)
            payload.seek(0)
            with services.database_sessions.begin() as database:
                PublisherService(database).require_role(
                    authenticated.user.id, publisher, "editor"
                )
                try:
                    stored = store.put(sha256, payload)
                except SourceBundleError as error:
                    raise Problem(
                        422,
                        error.code,
                        "Source bundle was rejected",
                        error.detail,
                    ) from error
                manifest = stored.manifest
                row = database.get(SourceBundle, manifest.sha256)
                if row is None:
                    row = SourceBundle(
                        sha256=manifest.sha256,
                        media_type="application/vnd.vonk.source-bundle.v1+tar",
                        archive_bytes=stored.archive_bytes,
                        total_bytes=manifest.total_bytes,
                        file_count=len(manifest.files),
                        storage_key=f"{manifest.sha256[:2]}/{manifest.sha256}.tar",
                        manifest={
                            "schema_version": 1,
                            "files": [asdict(item) for item in manifest.files],
                            "total_bytes": manifest.total_bytes,
                            "sha256": manifest.sha256,
                        },
                        verified_at=datetime.now(UTC),
                    )
                    database.add(row)
        return {
            "sha256": manifest.sha256,
            "archive_bytes": stored.archive_bytes,
            "total_bytes": manifest.total_bytes,
            "file_count": len(manifest.files),
            "files": [item.path for item in manifest.files],
        }

    return router
