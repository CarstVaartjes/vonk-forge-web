import copy
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from vonk_catalog.models import Publisher, Recipe, RecipeRevision
from vonk_catalog.search import SearchService, search_document

FIXTURE = (
    Path(__file__).resolve().parents[2] / "schemas/fixtures/recipe-v1-minimal.json"
)
MULTI = (
    Path(__file__).resolve().parents[2] / "schemas/fixtures/recipe-v1-multinode.json"
)


def _add(session, publisher, slug, title, document, age):
    recipe = Recipe(publisher_id=publisher.id, slug=slug, title=title, state="active")
    session.add(recipe)
    session.flush()
    document = copy.deepcopy(document)
    document["identity"] = {"publisher": publisher.slug, "slug": slug}
    document["metadata"]["title"] = title
    revision = RecipeRevision(
        recipe_id=recipe.id,
        revision_number=1,
        content_sha256=(slug[0] * 64),
        schema_version=1,
        document=document,
        published_at=datetime(2026, 8, 7, tzinfo=UTC) - timedelta(days=age),
    )
    session.add(revision)
    session.flush()
    session.add(search_document(publisher, recipe, revision))
    session.flush()
    return revision


def test_faceted_search_official_capability_topology_resources_and_cursor(
    session,
) -> None:
    official = Publisher(slug="vonk", name="Vonk", system_role="official")
    community = Publisher(slug="community", name="Community")
    session.add_all([official, community])
    session.flush()
    minimal = json.loads(FIXTURE.read_text())
    multi = json.loads(MULTI.read_text())
    _add(session, official, "qwen", "Qwen Fast", minimal, 0)
    _add(session, community, "deepseek", "DeepSeek Cluster", multi, 1)

    search = SearchService(session)
    assert [item.recipe.slug for item in search.search(query="qwen").items] == ["qwen"]
    assert [item.recipe.slug for item in search.search(official=False).items] == [
        "deepseek"
    ]
    assert [
        item.recipe.slug
        for item in search.search(topology="gang", tested_node_count=2).items
    ] == ["deepseek"]
    capability = multi["workload"]["capabilities"][0]
    assert search.search(capability=capability).items
    assert not search.search(max_installed_bytes=1).items

    first = search.search(limit=1)
    assert first.next_cursor is not None and first.items[0].recipe.slug == "qwen"
    second = search.search(limit=1, cursor=first.next_cursor)
    assert second.items[0].recipe.slug == "deepseek"


def test_sql_filters_can_find_matches_after_more_than_one_thousand_candidates(
    session,
) -> None:
    publisher = Publisher(slug="large-catalog", name="Large Catalog")
    session.add(publisher)
    session.flush()
    minimal = json.loads(FIXTURE.read_text())
    for index in range(1001):
        _add(
            session,
            publisher,
            f"model-{index:04d}",
            f"Model {index:04d}",
            minimal,
            index + 1,
        )
    matching = copy.deepcopy(minimal)
    matching["workload"]["capabilities"] = ["openai.embeddings"]
    _add(session, publisher, "target", "Target", matching, 0)

    page = SearchService(session).search(
        capability="openai.embeddings", sort="title", limit=20
    )

    assert [item.recipe.slug for item in page.items] == ["target"]
