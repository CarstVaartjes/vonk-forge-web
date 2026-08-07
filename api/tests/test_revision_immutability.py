import json
from datetime import UTC, datetime
from pathlib import Path

import pytest
from vonk_catalog.models import Publisher, Recipe, RecipeRevision

FIXTURE = (
    Path(__file__).resolve().parents[2] / "schemas/fixtures/recipe-v1-minimal.json"
)


def test_orm_rejects_revision_update_and_delete(session) -> None:
    publisher = Publisher(slug="immutable-lab", name="Immutable Lab")
    session.add(publisher)
    session.flush()
    recipe = Recipe(publisher_id=publisher.id, slug="recipe", title="Recipe")
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
    session.commit()

    revision.content_sha256 = "2" * 64
    with pytest.raises(ValueError, match="immutable"):
        session.commit()
    session.rollback()

    revision = session.get(RecipeRevision, revision.id)
    session.delete(revision)
    with pytest.raises(ValueError, match="immutable"):
        session.commit()
