import runpy
from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from vonk_catalog.canonical import content_sha256
from vonk_catalog.models import Base, Publisher, Recipe, RecipeRevision


def verifier():
    path = Path(__file__).resolve().parents[2] / "scripts" / "verify-restored-database"
    return runpy.run_path(str(path))["inspect_database"]


def test_restore_verifier_counts_rows_and_recomputes_canonical_samples(
    tmp_path: Path,
) -> None:
    url = f"sqlite:///{tmp_path / 'restore.db'}"
    engine = create_engine(url)
    Base.metadata.create_all(engine)
    document = {"schema_version": 1, "metadata": {"title": "Verified"}}
    with Session(engine) as session:
        publisher = Publisher(slug="vonk", name="Vonk")
        session.add(publisher)
        session.flush()
        recipe = Recipe(publisher_id=publisher.id, slug="verified", title="Verified")
        session.add(recipe)
        session.flush()
        session.add(
            RecipeRevision(
                recipe_id=recipe.id,
                revision_number=1,
                content_sha256=content_sha256(document),
                schema_version=1,
                document=document,
                published_at=datetime(2026, 8, 7, tzinfo=UTC),
            )
        )
        session.commit()

    result = verifier()(url, 100)

    assert result["counts"]["recipe_revisions"] == 1
    assert result["canonical_samples"][0]["content_sha256"] == content_sha256(document)
    assert result["revision_hash_aggregate"] != content_sha256({})


def test_restore_verifier_stops_on_canonical_hash_mismatch(tmp_path: Path) -> None:
    url = f"sqlite:///{tmp_path / 'corrupt.db'}"
    engine = create_engine(url)
    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO publishers (id, slug, name, system_role, created_at) "
                "VALUES ('publisher', 'vonk', 'Vonk', 'community', CURRENT_TIMESTAMP)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO recipes (id, publisher_id, slug, title, state, created_at, updated_at) "
                "VALUES ('recipe', 'publisher', 'bad', 'Bad', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO recipe_revisions "
                "(id, recipe_id, revision_number, content_sha256, schema_version, document, published_at) "
                "VALUES ('revision', 'recipe', 1, :hash, 1, :document, CURRENT_TIMESTAMP)"
            ),
            {"hash": "0" * 64, "document": '{"schema_version":1}'},
        )

    with pytest.raises(RuntimeError, match="canonical revision hash mismatch"):
        verifier()(url, 100)
