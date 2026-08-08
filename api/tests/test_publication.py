import copy
import json
from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import select
from vonk_catalog.drafts import DraftService
from vonk_catalog.models import (
    Publisher,
    PublisherMembership,
    Recipe,
    RecipeFork,
    RevisionSourceBundle,
    SourceBundle,
    User,
    ValidationResult,
)
from vonk_catalog.moderation import ModerationService
from vonk_catalog.problems import Problem
from vonk_catalog.publication import PublicationService

FIXTURE = (
    Path(__file__).resolve().parents[2] / "schemas/fixtures/recipe-v1-minimal.json"
)


def _setup(session):
    user = User(display_name="Ada")
    official = Publisher(slug="vonk", name="Vonk Forge", system_role="official")
    community = Publisher(slug="ada-lab", name="Ada Lab")
    session.add_all([user, official, community])
    session.flush()
    session.add_all(
        [
            PublisherMembership(
                publisher_id=official.id, user_id=user.id, role="owner"
            ),
            PublisherMembership(
                publisher_id=community.id, user_id=user.id, role="owner"
            ),
        ]
    )
    session.add(
        SourceBundle(
            sha256="a" * 64,
            media_type="application/vnd.vonk-forge.source-bundle.v1+tar",
            archive_bytes=1,
            total_bytes=1,
            file_count=1,
            storage_key=f"aa/{'a' * 64}.tar",
            manifest={"schema_version": 1, "files": [{"path": "Dockerfile"}]},
            verified_at=datetime(2026, 8, 7, tzinfo=UTC),
        )
    )
    session.flush()
    return user, official, community


def _draft(session, user: User, publisher: Publisher, key: str = "upload"):
    return DraftService(session).create(
        user.id,
        publisher.slug,
        json.loads(FIXTURE.read_text()),
        idempotency_key=key,
    )


def _pass(session, draft) -> None:
    session.add(
        ValidationResult(
            draft_id=draft.id,
            draft_version=draft.version,
            content_sha256=draft.content_sha256,
            status="passed",
            checks=[{"code": "all", "passed": True}],
        )
    )
    session.flush()


def test_validation_is_required_and_changed_draft_must_revalidate(session) -> None:
    user, _, publisher = _setup(session)
    draft = _draft(session, user, publisher)
    service = PublicationService(session)
    with pytest.raises(Problem) as missing:
        service.publish(user.id, publisher.slug, draft.id, idempotency_key="publish-1")
    assert missing.value.code == "publication.validation_required"

    _pass(session, draft)
    changed = copy.deepcopy(draft.document)
    changed["metadata"]["title"] = "Changed after validation"
    DraftService(session).update(
        user.id, publisher.slug, draft.id, changed, expected_version=1
    )
    with pytest.raises(Problem) as stale:
        service.publish(user.id, publisher.slug, draft.id, idempotency_key="publish-2")
    assert stale.value.code == "publication.validation_required"


def test_publish_is_immutable_numbered_idempotent_and_official_is_derived(
    session,
) -> None:
    user, official, _ = _setup(session)
    draft = _draft(session, user, official)
    _pass(session, draft)
    service = PublicationService(
        session, clock=lambda: datetime(2026, 8, 7, tzinfo=UTC)
    )
    first = service.publish(user.id, official.slug, draft.id, idempotency_key="publish")
    replay = service.publish(
        user.id, official.slug, draft.id, idempotency_key="publish"
    )
    assert first.revision.id == replay.revision.id
    assert first.revision.revision_number == 1
    assert first.official
    assert first.revision.content_sha256 == draft.content_sha256
    assert (
        session.get(RevisionSourceBundle, first.revision.id).source_bundle_sha256
        == "a" * 64
    )

    with pytest.raises(Problem) as conflict:
        service.publish(
            user.id, official.slug, draft.id, idempotency_key="different-key"
        )
    assert conflict.value.code == "publication.already_published"


def test_validation_and_publication_require_the_exact_uploaded_source(session) -> None:
    user, official, _ = _setup(session)
    draft = _draft(session, user, official)
    session.delete(session.get(SourceBundle, "a" * 64))
    session.flush()

    with pytest.raises(Problem) as missing:
        PublicationService(session).request_validation(user.id, official.slug, draft.id)

    assert missing.value.code == "publication.source_bundle_required"


def test_fork_preserves_source_revision_hash_and_requires_own_validation(
    session,
) -> None:
    user, official, community = _setup(session)
    source_draft = _draft(session, user, official, "source")
    _pass(session, source_draft)
    service = PublicationService(session)
    source = service.publish(
        user.id, official.slug, source_draft.id, idempotency_key="source-publish"
    )
    fork = service.fork(
        user.id,
        community.slug,
        source.revision.id,
        new_slug="community-copy",
        idempotency_key="fork",
    )
    assert fork.document["identity"] == {
        "publisher": "ada-lab",
        "slug": "community-copy",
    }
    assert fork.document["provenance"]["source_kind"] == "fork"
    assert (
        source.revision.content_sha256
        in fork.document["provenance"]["source_reference"]
    )
    assert session.scalar(
        select(RecipeFork).where(RecipeFork.recipe_id == fork.recipe_id)
    )
    with pytest.raises(Problem) as missing:
        service.publish(
            user.id, community.slug, fork.id, idempotency_key="fork-publish"
        )
    assert missing.value.code == "publication.validation_required"


def test_hidden_or_suspended_source_revision_cannot_be_forked(session) -> None:
    user, official, community = _setup(session)
    user.system_role = "admin"
    source_draft = _draft(session, user, official, "moderated-source")
    _pass(session, source_draft)
    service = PublicationService(session)
    source = service.publish(
        user.id, official.slug, source_draft.id, idempotency_key="moderated-publish"
    )
    moderation = ModerationService(session)
    moderation.revision_action(
        user.id,
        source.revision.id,
        "hide",
        "Safety investigation",
        step_up_confirmed=True,
    )

    with pytest.raises(Problem) as hidden:
        service.fork(
            user.id,
            community.slug,
            source.revision.id,
            new_slug="hidden-copy",
            idempotency_key="hidden-copy",
        )
    assert hidden.value.code == "publication.source_not_found"

    moderation.revision_action(
        user.id,
        source.revision.id,
        "unhide",
        "Safety review complete",
        step_up_confirmed=True,
    )
    moderation.suspend_publisher(
        user.id, official.id, "Publisher investigation", step_up_confirmed=True
    )
    with pytest.raises(Problem) as suspended:
        service.fork(
            user.id,
            community.slug,
            source.revision.id,
            new_slug="suspended-copy",
            idempotency_key="suspended-copy",
        )
    assert suspended.value.code == "publication.source_not_found"


def test_inactive_source_recipe_cannot_be_forked(session) -> None:
    user, official, community = _setup(session)
    source_draft = _draft(session, user, official, "inactive-source")
    _pass(session, source_draft)
    service = PublicationService(session)
    source = service.publish(
        user.id, official.slug, source_draft.id, idempotency_key="inactive-publish"
    )
    recipe = session.get(Recipe, source.revision.recipe_id)
    assert recipe is not None
    recipe.state = "inactive"
    session.flush()

    with pytest.raises(Problem) as inactive:
        service.fork(
            user.id,
            community.slug,
            source.revision.id,
            new_slug="inactive-copy",
            idempotency_key="inactive-copy",
        )
    assert inactive.value.code == "publication.source_not_found"
