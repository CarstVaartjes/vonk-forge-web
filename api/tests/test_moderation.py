import json
from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy.orm import Session
from vonk_catalog.models import (
    ModerationEvent,
    Publisher,
    Recipe,
    RecipeRevision,
    User,
)
from vonk_catalog.moderation import ModerationService
from vonk_catalog.problems import Problem

FIXTURE = (
    Path(__file__).resolve().parents[2] / "schemas/fixtures/recipe-v1-minimal.json"
)


def _revision(session, publisher_slug="community", official=False):
    publisher = Publisher(
        slug=publisher_slug,
        name=publisher_slug.title(),
        system_role="official" if official else None,
    )
    recipe = Recipe(publisher_id=publisher.id, slug="model", title="Model")
    session.add(publisher)
    session.flush()
    recipe.publisher_id = publisher.id
    session.add(recipe)
    session.flush()
    revision = RecipeRevision(
        recipe_id=recipe.id,
        revision_number=1,
        content_sha256="1" * 64,
        schema_version=1,
        document=json.loads(FIXTURE.read_text()),
        published_at=datetime(2026, 8, 7, tzinfo=UTC),
    )
    session.add(revision)
    session.flush()
    return publisher, revision


def test_reports_are_rate_limited_and_moderation_is_reversible_append_only(
    session,
) -> None:
    now = datetime(2026, 8, 7, 12, tzinfo=UTC)
    _, revision = _revision(session)
    moderator = User(display_name="Mod", system_role="moderator")
    session.add(moderator)
    session.flush()
    service = ModerationService(session, clock=lambda: now, report_limit=2)
    service.report(revision.id, None, "203.0.113.4", "malware", "Suspicious image")
    service.report(revision.id, None, "203.0.113.4", "security", "Second report")
    with pytest.raises(Problem) as limited:
        service.report(revision.id, None, "203.0.113.4", "other", "Third report")
    assert limited.value.code == "moderation.report_rate_limited"

    service.revision_action(moderator.id, revision.id, "hide", "Investigating")
    service.revision_action(
        moderator.id, revision.id, "compromise_warning", "Registry compromise"
    )
    state = service.revision_state(revision.id)
    assert state.hidden and state.warning == "Registry compromise"
    service.revision_action(
        moderator.id, revision.id, "appeal_note", "Publisher supplied evidence"
    )
    service.revision_action(moderator.id, revision.id, "unhide", "Evidence reviewed")
    assert not service.revision_state(revision.id).hidden
    assert revision.document["schema_version"] == 1

    event = session.query(ModerationEvent).first()
    event.reason = "rewrite"
    with pytest.raises(ValueError, match="append-only"):
        session.flush()


def test_suspension_and_official_actions_require_admin_step_up(session) -> None:
    official, revision = _revision(session, "vonk", official=True)
    moderator = User(display_name="Mod", system_role="moderator")
    admin = User(display_name="Admin", system_role="admin")
    session.add_all([moderator, admin])
    session.flush()
    service = ModerationService(session)

    with pytest.raises(Problem) as role:
        service.suspend_publisher(
            moderator.id, official.id, "Emergency", step_up_confirmed=True
        )
    assert role.value.code == "moderation.admin_required"
    with pytest.raises(Problem) as step_up:
        service.suspend_publisher(
            admin.id, official.id, "Emergency", step_up_confirmed=False
        )
    assert step_up.value.code == "moderation.step_up_required"

    service.suspend_publisher(
        admin.id, official.id, "Emergency", step_up_confirmed=True
    )
    assert service.publisher_suspended(official.id)
    service.reinstate_publisher(
        admin.id, official.id, "Resolved", step_up_confirmed=True
    )
    assert not service.publisher_suspended(official.id)

    with pytest.raises(Problem):
        service.revision_action(
            moderator.id, revision.id, "hide", "No", step_up_confirmed=False
        )
    service.revision_action(
        admin.id, revision.id, "hide", "Confirmed", step_up_confirmed=True
    )
    assert service.revision_state(revision.id).hidden


def test_hidden_revision_is_removed_from_anonymous_catalog_and_unhide_restores_it(
    client, engine
) -> None:
    with Session(engine, expire_on_commit=False) as database:
        publisher, revision = _revision(database, "visible-community")
        moderator = User(display_name="Mod", system_role="moderator")
        database.add(moderator)
        database.flush()
        service = ModerationService(database)
        service.revision_action(moderator.id, revision.id, "hide", "Safety review")
        database.commit()
        revision_id, moderator_id = revision.id, moderator.id

    assert client.get("/v1/recipes/visible-community/model").status_code == 404
    with Session(engine) as database:
        ModerationService(database).revision_action(
            moderator_id, revision_id, "unhide", "Review complete"
        )
        database.commit()
    assert client.get("/v1/recipes/visible-community/model").status_code == 200
