import json
from pathlib import Path

from vonk_catalog.drafts import DraftService
from vonk_catalog.jobs import enqueue_draft_validation
from vonk_catalog.models import Publisher, PublisherMembership, User

FIXTURE = (
    Path(__file__).resolve().parents[2] / "schemas/fixtures/recipe-v1-minimal.json"
)


def test_validation_job_is_idempotent_for_exact_draft_version(session) -> None:
    user = User(display_name="Ada")
    publisher = Publisher(slug="ada-lab", name="Ada Lab")
    session.add_all([user, publisher])
    session.flush()
    session.add(
        PublisherMembership(publisher_id=publisher.id, user_id=user.id, role="owner")
    )
    session.flush()
    draft = DraftService(session).create(
        user.id,
        publisher.slug,
        json.loads(FIXTURE.read_text()),
        idempotency_key="upload",
    )
    first = enqueue_draft_validation(session, draft)
    second = enqueue_draft_validation(session, draft)
    assert first.id == second.id
    assert first.payload == {
        "draft_id": draft.id,
        "draft_version": 1,
        "content_sha256": draft.content_sha256,
    }
