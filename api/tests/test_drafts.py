import copy
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker
from vonk_catalog.api import create_app
from vonk_catalog.drafts import DraftService
from vonk_catalog.models import (
    Publisher,
    PublisherMembership,
    RecipeDraft,
    User,
    ValidationResult,
)
from vonk_catalog.models import (
    TestReport as StoredTestReport,
)
from vonk_catalog.problems import Problem
from vonk_catalog.session import SessionService
from vonk_catalog.settings import Settings

FIXTURE = (
    Path(__file__).resolve().parents[2] / "schemas/fixtures/recipe-v1-minimal.json"
)


def _setup(session):
    owner = User(display_name="Ada")
    outsider = User(display_name="Eve")
    publisher = Publisher(slug="ada-labs", name="Ada Labs")
    session.add_all([owner, outsider, publisher])
    session.flush()
    session.add(
        PublisherMembership(publisher_id=publisher.id, user_id=owner.id, role="owner")
    )
    session.flush()
    return owner, outsider, publisher


def _recipe() -> dict[str, object]:
    return json.loads(FIXTURE.read_text())


def test_create_update_read_delete_and_force_destination_identity(session) -> None:
    owner, _, publisher = _setup(session)
    document = _recipe()
    original_source = copy.deepcopy(document["provenance"])
    document["identity"]["publisher"] = "local-machine"
    service = DraftService(session)
    draft = service.create(
        owner.id, publisher.slug, document, idempotency_key="local-1"
    )
    replay = service.create(
        owner.id, publisher.slug, document, idempotency_key="local-1"
    )
    assert replay.id == draft.id
    assert draft.document["identity"]["publisher"] == publisher.slug
    assert draft.document["provenance"] == original_source
    assert draft.version == 1

    changed = copy.deepcopy(draft.document)
    changed["metadata"]["title"] = "Updated"
    updated = service.update(
        owner.id, publisher.slug, draft.id, changed, expected_version=1
    )
    assert updated.version == 2 and updated.document["metadata"]["title"] == "Updated"

    with pytest.raises(Problem) as conflict:
        service.update(owner.id, publisher.slug, draft.id, changed, expected_version=1)
    assert conflict.value.code == "draft.version_conflict"

    service.delete(owner.id, publisher.slug, draft.id, expected_version=2)
    session.flush()
    assert session.get(RecipeDraft, draft.id) is None


def test_schema_paths_evidence_hash_and_cross_publisher_access(session) -> None:
    owner, outsider, publisher = _setup(session)
    service = DraftService(session)
    invalid = _recipe()
    invalid["resources"]["per_node"]["installed_bytes"] = 0
    with pytest.raises(Problem) as schema:
        service.create(owner.id, publisher.slug, invalid, idempotency_key="bad")
    assert schema.value.code == "draft.schema_invalid"
    assert "resources.per_node.installed_bytes" in schema.value.detail

    valid = _recipe()
    draft = service.create(owner.id, publisher.slug, valid, idempotency_key="good")
    with pytest.raises(Problem) as denied:
        service.get(outsider.id, publisher.slug, draft.id)
    assert denied.value.code == "publisher.access_denied"

    report = {"schema_version": 1, "recipe_sha256": "0" * 64}
    service.add_test_report(owner.id, publisher.slug, draft.id, report)
    assert session.scalar(
        select(StoredTestReport).where(StoredTestReport.draft_id == draft.id)
    )


def test_idempotency_key_cannot_be_reused_for_other_content(session) -> None:
    owner, _, publisher = _setup(session)
    service = DraftService(session)
    first = _recipe()
    service.create(owner.id, publisher.slug, first, idempotency_key="same-key")
    changed = copy.deepcopy(first)
    changed["metadata"]["title"] = "Different"
    with pytest.raises(Problem) as mismatch:
        service.create(owner.id, publisher.slug, changed, idempotency_key="same-key")
    assert mismatch.value.code == "draft.idempotency_conflict"


def test_http_upload_returns_etag_and_requires_it_for_update(engine) -> None:
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    with sessions.begin() as database:
        owner, _, publisher = _setup(database)
        owner_id, publisher_slug = owner.id, publisher.slug
    settings = Settings(session_secret="u" * 64)
    created_session = SessionService(sessions, b"u" * 64).create(
        owner_id, "testclient", "browser"
    )
    with TestClient(
        create_app(database_sessions=sessions, settings=settings)
    ) as client:
        client.cookies.set("vonk_session", created_session.token)
        headers = {
            "X-CSRF-Token": created_session.csrf_token,
            "Idempotency-Key": "http-upload-1",
        }
        response = client.post(
            f"/v1/publishers/{publisher_slug}/drafts",
            headers=headers,
            json={"recipe": _recipe()},
        )
        assert response.status_code == 201
        assert response.headers["etag"] == '"draft-version-1"'
        location = response.headers["location"]
        assert (
            client.put(
                location,
                headers={"X-CSRF-Token": created_session.csrf_token},
                json={"recipe": _recipe()},
            ).status_code
            == 428
        )
        updated = client.put(
            location,
            headers={
                "X-CSRF-Token": created_session.csrf_token,
                "If-Match": response.headers["etag"],
            },
            json={"recipe": _recipe()},
        )
        assert updated.status_code == 200
        assert updated.headers["etag"] == '"draft-version-2"'

        with sessions.begin() as database:
            stored = database.get(RecipeDraft, updated.json()["id"])
            database.add(
                ValidationResult(
                    draft_id=stored.id,
                    draft_version=stored.version,
                    content_sha256=stored.content_sha256,
                    status="passed",
                    checks=[
                        {
                            "code": "registry.arm64_available",
                            "passed": True,
                            "detail": "linux/arm64 manifest found",
                        }
                    ],
                )
            )

        loaded = client.get(location)
        assert loaded.json()["validation"]["status"] == "passed"
        assert loaded.json()["validation"]["checks"][0]["code"] == (
            "registry.arm64_available"
        )
