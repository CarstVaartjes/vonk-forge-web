from datetime import UTC, datetime

from sqlalchemy.orm import Session
from vonk_catalog.models import Publisher, Recipe, RecipeRevision
from vonk_catalog.search import search_document


def publish(engine, *, slug: str = "qwen3") -> RecipeRevision:
    with Session(engine, expire_on_commit=False) as session:
        publisher = Publisher(slug="vonk", name="Vonk", system_role="official")
        session.add(publisher)
        session.flush()
        recipe = Recipe(publisher_id=publisher.id, slug=slug, title="Qwen3")
        session.add(recipe)
        session.flush()
        revision = RecipeRevision(
            recipe_id=recipe.id,
            revision_number=1,
            content_sha256="c" * 64,
            schema_version=1,
            document={
                "schema_version": 1,
                "identity": {"publisher": "vonk", "slug": slug},
                "metadata": {"title": "Qwen3", "description": "Demo", "tags": []},
                "workload": {"family": "qwen3", "capabilities": ["openai.chat"]},
                "runtime": {"family": "vllm"},
                "resources": {
                    "per_node": {"installed_bytes": 66, "resident_memory_bytes": 72}
                },
                "topology": {"kind": "single", "min_nodes": 1, "max_nodes": 1},
            },
            published_at=datetime(2026, 8, 7, 12, 0, tzinfo=UTC),
        )
        session.add(revision)
        session.flush()
        session.add(search_document(publisher, recipe, revision))
        session.commit()
        return revision


def test_revision_bytes_are_etagged_but_moderation_is_revalidated(
    client, engine
) -> None:
    published = publish(engine)

    response = client.get("/v1/recipes/vonk/qwen3/revisions/1")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=0, must-revalidate"
    assert response.headers["etag"] == f'"sha256:{published.content_sha256}"'
    assert response.json()["content_sha256"] == published.content_sha256
    assert response.json()["document"]["identity"]["slug"] == "qwen3"


def test_revision_etag_supports_not_modified(client, engine) -> None:
    published = publish(engine)
    response = client.get(
        "/v1/recipes/vonk/qwen3/revisions/1",
        headers={"If-None-Match": f'"sha256:{published.content_sha256}"'},
    )

    assert response.status_code == 304
    assert response.content == b""


def test_revision_is_permanently_addressable_by_content_hash(client, engine) -> None:
    published = publish(engine)

    response = client.get(
        f"/v1/recipes/vonk/qwen3/revisions/sha256/{published.content_sha256}"
    )

    assert response.status_code == 200
    assert response.json()["revision_id"] == published.id
    assert response.json()["recipe_id"] == published.recipe_id
    assert response.headers["etag"] == f'"sha256:{published.content_sha256}"'

    missing = client.get(f"/v1/recipes/vonk/qwen3/revisions/sha256/{'0' * 64}")
    assert missing.status_code == 404


def test_catalog_lists_latest_published_recipe(client, engine) -> None:
    publish(engine)

    response = client.get("/v1/recipes", params={"runtime": "vllm", "limit": 20})

    assert response.status_code == 200
    assert response.json()["items"][0]["publisher"] == "vonk"
    assert response.json()["items"][0]["slug"] == "qwen3"
    assert response.json()["items"][0]["official"] is True


def test_recipe_detail_points_to_latest_revision(client, engine) -> None:
    publish(engine)

    response = client.get("/v1/recipes/vonk/qwen3")

    assert response.status_code == 200
    assert response.json()["latest_revision"]["revision_number"] == 1


def test_missing_recipe_uses_stable_problem_document(client) -> None:
    response = client.get("/v1/recipes/vonk/missing")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/problem+json")
    body = response.json()
    assert body["code"] == "catalog.not_found"
    assert body["request_id"]
    assert "SQL" not in body["detail"]


def test_recipe_schema_is_served_from_the_versioned_contract(client) -> None:
    response = client.get("/v1/schemas/recipe/v1")

    assert response.status_code == 200
    assert response.json()["$id"].endswith("/schemas/recipe/v1.schema.json")
