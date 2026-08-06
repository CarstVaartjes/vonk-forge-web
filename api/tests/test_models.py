from datetime import UTC, datetime

import pytest
from sqlalchemy.exc import IntegrityError

from vonk_catalog.models import (
    OAuthAccount,
    Publisher,
    PublisherMembership,
    Recipe,
    RecipeRevision,
    User,
)


def persist_identity(session):
    user = User(display_name="Publisher")
    publisher = Publisher(slug="community", name="Community")
    session.add_all([user, publisher])
    session.flush()
    session.add(PublisherMembership(user_id=user.id, publisher_id=publisher.id, role="owner"))
    recipe = Recipe(publisher_id=publisher.id, slug="demo", title="Demo")
    session.add(recipe)
    session.flush()
    return user, publisher, recipe


def test_oauth_subject_is_unique_per_provider(session) -> None:
    user = User(display_name="One")
    second = User(display_name="Two")
    session.add_all([user, second])
    session.flush()
    session.add(
        OAuthAccount(user_id=user.id, provider="github", subject="123", email=None)
    )
    session.flush()
    session.add(
        OAuthAccount(user_id=second.id, provider="github", subject="123", email=None)
    )

    with pytest.raises(IntegrityError):
        session.flush()


def test_recipe_slug_is_unique_inside_publisher(session) -> None:
    _, publisher, _ = persist_identity(session)
    session.add(Recipe(publisher_id=publisher.id, slug="demo", title="Duplicate"))

    with pytest.raises(IntegrityError):
        session.flush()


def test_revision_hash_and_number_are_unique_per_recipe(session) -> None:
    _, _, recipe = persist_identity(session)
    published_at = datetime.now(UTC)
    session.add_all(
        [
            RecipeRevision(
                recipe_id=recipe.id,
                revision_number=1,
                content_sha256="a" * 64,
                schema_version=1,
                document={"schema_version": 1},
                published_at=published_at,
            ),
            RecipeRevision(
                recipe_id=recipe.id,
                revision_number=2,
                content_sha256="a" * 64,
                schema_version=1,
                document={"schema_version": 1},
                published_at=published_at,
            ),
        ]
    )

    with pytest.raises(IntegrityError):
        session.flush()


def test_published_revision_cannot_be_mutated_or_deleted(session) -> None:
    _, _, recipe = persist_identity(session)
    revision = RecipeRevision(
        recipe_id=recipe.id,
        revision_number=1,
        content_sha256="b" * 64,
        schema_version=1,
        document={"schema_version": 1},
        published_at=datetime.now(UTC),
    )
    session.add(revision)
    session.commit()

    revision.document = {"schema_version": 2}
    with pytest.raises(ValueError, match="immutable"):
        session.flush()
    session.rollback()

    revision = session.get(RecipeRevision, revision.id)
    assert revision is not None
    session.delete(revision)
    with pytest.raises(ValueError, match="immutable"):
        session.flush()
