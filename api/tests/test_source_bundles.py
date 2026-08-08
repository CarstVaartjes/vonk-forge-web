from __future__ import annotations

import io
import tarfile
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from vonk_catalog.source_bundles import (
    BundleLimits,
    SourceBundleError,
    SourceBundleStore,
    inspect_source_bundle,
)
from vonk_catalog.api import create_app
from vonk_catalog.models import (
    Publisher,
    PublisherMembership,
    Recipe,
    RecipeRevision,
    RevisionSourceBundle,
    User,
)
from vonk_catalog.session import SessionService
from vonk_catalog.settings import Settings


LIMITS = BundleLimits(
    max_archive_bytes=16_384,
    max_files=8,
    max_file_bytes=4096,
    max_total_bytes=8192,
)


def archive(files: list[tuple[str, bytes]]) -> bytes:
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w") as bundle:
        for name, content in files:
            info = tarfile.TarInfo(name)
            info.size = len(content)
            info.mode = 0o644
            bundle.addfile(info, io.BytesIO(content))
    return output.getvalue()


@pytest.mark.parametrize("name", ["/etc/passwd", "../escape", "a/../../escape"])
def test_bundle_rejects_paths_outside_context(name: str) -> None:
    with pytest.raises(SourceBundleError) as error:
        inspect_source_bundle(io.BytesIO(archive([(name, b"x")])), LIMITS)

    assert error.value.code == "bundle.path_forbidden"


def test_bundle_digest_is_archive_order_independent() -> None:
    first = inspect_source_bundle(
        io.BytesIO(archive([("Dockerfile", b"FROM scratch\n"), ("x", b"1")])),
        LIMITS,
    )
    second = inspect_source_bundle(
        io.BytesIO(archive([("x", b"1"), ("Dockerfile", b"FROM scratch\n")])),
        LIMITS,
    )

    assert first.sha256 == second.sha256
    assert [item.path for item in first.files] == ["Dockerfile", "x"]


def test_bundle_rejects_links_and_expansion_overflow() -> None:
    linked = io.BytesIO()
    with tarfile.open(fileobj=linked, mode="w") as bundle:
        info = tarfile.TarInfo("link")
        info.type = tarfile.SYMTYPE
        info.linkname = "/etc/passwd"
        bundle.addfile(info)
    with pytest.raises(SourceBundleError, match="regular files"):
        inspect_source_bundle(io.BytesIO(linked.getvalue()), LIMITS)

    with pytest.raises(SourceBundleError) as error:
        inspect_source_bundle(io.BytesIO(archive([("large", b"x" * 4097)])), LIMITS)
    assert error.value.code == "bundle.file_too_large"


def test_store_is_content_addressed_and_idempotent(tmp_path) -> None:
    payload = archive([("Dockerfile", b"FROM scratch\n")])
    manifest = inspect_source_bundle(io.BytesIO(payload), LIMITS)
    store = SourceBundleStore(tmp_path, limits=LIMITS)

    first = store.put(manifest.sha256, io.BytesIO(payload))
    second = store.put(manifest.sha256, io.BytesIO(payload))

    assert first == second
    assert first.path.read_bytes() == payload


def test_store_rejects_expected_digest_mismatch(tmp_path) -> None:
    store = SourceBundleStore(tmp_path, limits=LIMITS)
    with pytest.raises(SourceBundleError) as error:
        store.put("f" * 64, io.BytesIO(archive([("Dockerfile", b"FROM scratch\n")])))

    assert error.value.code == "bundle.digest_mismatch"


def test_authenticated_upload_stays_private_until_an_immutable_revision_publishes_it(
    engine, tmp_path
) -> None:
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    with sessions.begin() as database:
        owner = User(display_name="Ada")
        publisher = Publisher(slug="ada-lab", name="Ada Lab")
        database.add_all([owner, publisher])
        database.flush()
        database.add(
            PublisherMembership(
                publisher_id=publisher.id, user_id=owner.id, role="owner"
            )
        )
        owner_id = owner.id
        publisher_id = publisher.id
    settings = Settings(
        session_secret="s" * 64, source_bundle_path=tmp_path / "source-bundles"
    )
    browser = SessionService(sessions, b"s" * 64).create(
        owner_id, "testclient", "browser"
    )
    payload = archive([("Dockerfile", b"FROM scratch\nUSER 65532:65532\n")])
    digest = inspect_source_bundle(io.BytesIO(payload)).sha256

    with TestClient(
        create_app(database_sessions=sessions, settings=settings)
    ) as client:
        client.cookies.set("vonk_session", browser.token)
        uploaded = client.put(
            f"/v1/publishers/ada-lab/source-bundles/{digest}",
            headers={
                "X-CSRF-Token": browser.csrf_token,
                "Content-Type": "application/vnd.vonk-forge.source-bundle.v1+tar",
            },
            content=payload,
        )
        assert uploaded.status_code == 200
        assert uploaded.json()["files"] == ["Dockerfile"]
        assert client.get(f"/v1/source-bundles/{digest}").status_code == 404

        with sessions.begin() as database:
            recipe = Recipe(
                publisher_id=publisher_id,
                slug="safe-source",
                title="Safe source",
                state="active",
            )
            database.add(recipe)
            database.flush()
            revision = RecipeRevision(
                recipe_id=recipe.id,
                revision_number=1,
                content_sha256="a" * 64,
                schema_version=1,
                document={"build": {"context": {"sha256": digest}}},
                published_at=datetime(2026, 8, 7, tzinfo=UTC),
            )
            database.add(revision)
            database.flush()
            database.add(
                RevisionSourceBundle(
                    revision_id=revision.id, source_bundle_sha256=digest
                )
            )

        downloaded = client.get(f"/v1/source-bundles/{digest}")
        assert downloaded.status_code == 200
        assert downloaded.content == payload
        assert downloaded.headers["etag"] == f'"sha256:{digest}"'


def test_source_upload_rejects_digest_substitution(engine, tmp_path) -> None:
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    with sessions.begin() as database:
        owner = User(display_name="Ada")
        publisher = Publisher(slug="ada-lab", name="Ada Lab")
        database.add_all([owner, publisher])
        database.flush()
        database.add(
            PublisherMembership(
                publisher_id=publisher.id, user_id=owner.id, role="owner"
            )
        )
        owner_id = owner.id
    settings = Settings(
        session_secret="s" * 64, source_bundle_path=tmp_path / "source-bundles"
    )
    browser = SessionService(sessions, b"s" * 64).create(
        owner_id, "testclient", "browser"
    )
    with TestClient(
        create_app(database_sessions=sessions, settings=settings)
    ) as client:
        client.cookies.set("vonk_session", browser.token)
        response = client.put(
            f"/v1/publishers/ada-lab/source-bundles/{'f' * 64}",
            headers={
                "X-CSRF-Token": browser.csrf_token,
                "Content-Type": "application/x-tar",
            },
            content=archive([("Dockerfile", b"FROM scratch\n")]),
        )
    assert response.status_code == 422
    assert response.json()["code"] == "bundle.digest_mismatch"
