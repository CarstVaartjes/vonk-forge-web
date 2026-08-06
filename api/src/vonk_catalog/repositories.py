from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from .models import Publisher, Recipe, RecipeRevision


@dataclass(frozen=True, slots=True)
class PublishedRecipe:
    publisher: Publisher
    recipe: Recipe
    revision: RecipeRevision


class CatalogRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def revision(
        self, publisher: str, slug: str, revision_number: int
    ) -> PublishedRecipe | None:
        statement = (
            select(Publisher, Recipe, RecipeRevision)
            .join(Recipe, Recipe.publisher_id == Publisher.id)
            .join(RecipeRevision, RecipeRevision.recipe_id == Recipe.id)
            .where(
                Publisher.slug == publisher,
                Recipe.slug == slug,
                Recipe.state == "active",
                RecipeRevision.revision_number == revision_number,
            )
        )
        row = self._session.execute(statement).one_or_none()
        return PublishedRecipe(*row) if row is not None else None

    def latest(self, publisher: str, slug: str) -> PublishedRecipe | None:
        statement = (
            select(Publisher, Recipe, RecipeRevision)
            .join(Recipe, Recipe.publisher_id == Publisher.id)
            .join(RecipeRevision, RecipeRevision.recipe_id == Recipe.id)
            .where(
                Publisher.slug == publisher,
                Recipe.slug == slug,
                Recipe.state == "active",
            )
            .order_by(RecipeRevision.revision_number.desc())
            .limit(1)
        )
        row = self._session.execute(statement).one_or_none()
        return PublishedRecipe(*row) if row is not None else None

    def list_latest(
        self,
        *,
        query: str | None,
        publisher: str | None,
        runtime: str | None,
        workload_family: str | None,
        topology: str | None,
        min_nodes: int | None,
        max_nodes: int | None,
        max_memory_bytes: int | None,
        max_installed_bytes: int | None,
        limit: int,
    ) -> list[PublishedRecipe]:
        latest_number = (
            select(
                RecipeRevision.recipe_id,
                func.max(RecipeRevision.revision_number).label("revision_number"),
            )
            .group_by(RecipeRevision.recipe_id)
            .subquery()
        )
        statement: Select[tuple[Publisher, Recipe, RecipeRevision]] = (
            select(Publisher, Recipe, RecipeRevision)
            .join(Recipe, Recipe.publisher_id == Publisher.id)
            .join(latest_number, latest_number.c.recipe_id == Recipe.id)
            .join(
                RecipeRevision,
                (RecipeRevision.recipe_id == latest_number.c.recipe_id)
                & (
                    RecipeRevision.revision_number
                    == latest_number.c.revision_number
                ),
            )
            .where(Recipe.state == "active")
            .order_by(RecipeRevision.published_at.desc(), RecipeRevision.id.desc())
        )
        if publisher is not None:
            statement = statement.where(Publisher.slug == publisher)
        if query is not None:
            pattern = f"%{query}%"
            statement = statement.where(
                Recipe.title.ilike(pattern) | Recipe.slug.ilike(pattern)
            )
        rows = self._session.execute(statement.limit(limit * 4)).all()
        results = [PublishedRecipe(*row) for row in rows]
        return [
            item
            for item in results
            if _matches_document(
                item.revision.document,
                runtime=runtime,
                workload_family=workload_family,
                topology=topology,
                min_nodes=min_nodes,
                max_nodes=max_nodes,
                max_memory_bytes=max_memory_bytes,
                max_installed_bytes=max_installed_bytes,
            )
        ][:limit]


def _matches_document(
    document: dict[str, object],
    *,
    runtime: str | None,
    workload_family: str | None,
    topology: str | None,
    min_nodes: int | None,
    max_nodes: int | None,
    max_memory_bytes: int | None,
    max_installed_bytes: int | None,
) -> bool:
    runtime_doc = document.get("runtime", {})
    workload_doc = document.get("workload", {})
    topology_doc = document.get("topology", {})
    resources_doc = document.get("resources", {})
    if not all(
        isinstance(value, dict)
        for value in (runtime_doc, workload_doc, topology_doc, resources_doc)
    ):
        return False
    per_node = resources_doc.get("per_node", {})
    if not isinstance(per_node, dict):
        return False
    checks = (
        runtime is None or runtime_doc.get("family") == runtime,
        workload_family is None or workload_doc.get("family") == workload_family,
        topology is None or topology_doc.get("kind") == topology,
        min_nodes is None or _integer(topology_doc.get("min_nodes")) >= min_nodes,
        max_nodes is None or _integer(topology_doc.get("max_nodes")) <= max_nodes,
        max_memory_bytes is None
        or _integer(per_node.get("resident_memory_bytes")) <= max_memory_bytes,
        max_installed_bytes is None
        or _integer(per_node.get("installed_bytes")) <= max_installed_bytes,
    )
    return all(checks)


def _integer(value: object) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) else 2**63 - 1
