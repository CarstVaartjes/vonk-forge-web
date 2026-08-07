from __future__ import annotations

import base64
import json
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Publisher, Recipe, RecipeRevision, RecipeSearchDocument
from .problems import Problem
from .repositories import PublishedRecipe


def search_document(
    publisher: Publisher, recipe: Recipe, revision: RecipeRevision
) -> RecipeSearchDocument:
    document = revision.document
    metadata = document["metadata"]
    runtime = document["runtime"]
    workload = document["workload"]
    topology = document["topology"]
    resources = document["resources"]["per_node"]
    values = [
        publisher.slug,
        publisher.name,
        recipe.slug,
        str(metadata["title"]),
        str(metadata["description"]),
        *[str(value) for value in metadata["tags"]],
        str(runtime["family"]),
        str(workload["family"]),
        *[str(value) for value in workload["capabilities"]],
    ]
    return RecipeSearchDocument(
        revision_id=revision.id,
        search_text="\n".join(values),
        runtime_family=str(runtime["family"]),
        workload_family=str(workload["family"]),
        topology_kind=str(topology["kind"]),
        min_nodes=int(topology["min_nodes"]),
        max_nodes=int(topology["max_nodes"]),
        tested_node_counts=[
            int(value)
            for value in topology.get("tested_node_counts", [topology["min_nodes"]])
        ],
        installed_bytes=int(resources["installed_bytes"]),
        resident_memory_bytes=int(resources["resident_memory_bytes"]),
        capabilities=[str(value) for value in workload["capabilities"]],
    )


@dataclass(frozen=True, slots=True)
class SearchPage:
    items: tuple[PublishedRecipe, ...]
    next_cursor: str | None


def _encode_cursor(sort: str, value: object, revision_id: str) -> str:
    payload = json.dumps(
        {"sort": sort, "value": value, "id": revision_id},
        separators=(",", ":"),
    ).encode()
    return base64.urlsafe_b64encode(payload).rstrip(b"=").decode()


def _decode_cursor(cursor: str | None, sort: str) -> tuple[object, str] | None:
    if cursor is None:
        return None
    try:
        padding = "=" * (-len(cursor) % 4)
        value = json.loads(base64.urlsafe_b64decode(cursor + padding))
        if (
            not isinstance(value, dict)
            or value.get("sort") != sort
            or not isinstance(value.get("id"), str)
        ):
            raise ValueError
        return value.get("value"), value["id"]
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise Problem(
            400,
            "catalog.cursor_invalid",
            "Search cursor is invalid",
            "Restart the search from the first page.",
        ) from error


class SearchService:
    def __init__(self, database: Session) -> None:
        self.database = database

    def search(
        self,
        *,
        query: str | None = None,
        publisher: str | None = None,
        official: bool | None = None,
        runtime: str | None = None,
        workload_family: str | None = None,
        capability: str | None = None,
        topology: str | None = None,
        min_nodes: int | None = None,
        max_nodes: int | None = None,
        tested_node_count: int | None = None,
        max_memory_bytes: int | None = None,
        max_installed_bytes: int | None = None,
        sort: str = "newest",
        cursor: str | None = None,
        limit: int = 20,
    ) -> SearchPage:
        if sort not in {"newest", "title", "disk", "memory"}:
            raise Problem(
                422,
                "catalog.sort_invalid",
                "Search sort is invalid",
                "Choose newest, title, disk, or memory.",
            )
        statement = (
            select(Publisher, Recipe, RecipeRevision, RecipeSearchDocument)
            .join(Recipe, Recipe.publisher_id == Publisher.id)
            .join(RecipeRevision, RecipeRevision.recipe_id == Recipe.id)
            .join(
                RecipeSearchDocument,
                RecipeSearchDocument.revision_id == RecipeRevision.id,
            )
            .where(Recipe.state == "active")
        )
        latest = (
            select(func.max(RecipeRevision.revision_number))
            .where(RecipeRevision.recipe_id == Recipe.id)
            .correlate(Recipe)
            .scalar_subquery()
        )
        statement = statement.where(RecipeRevision.revision_number == latest)
        if publisher is not None:
            statement = statement.where(Publisher.slug == publisher)
        if official is not None:
            statement = statement.where(
                Publisher.system_role == "official"
                if official
                else Publisher.system_role.is_(None)
            )
        if runtime is not None:
            statement = statement.where(RecipeSearchDocument.runtime_family == runtime)
        if workload_family is not None:
            statement = statement.where(
                RecipeSearchDocument.workload_family == workload_family
            )
        if topology is not None:
            statement = statement.where(RecipeSearchDocument.topology_kind == topology)
        if min_nodes is not None:
            statement = statement.where(RecipeSearchDocument.min_nodes >= min_nodes)
        if max_nodes is not None:
            statement = statement.where(RecipeSearchDocument.max_nodes <= max_nodes)
        if max_memory_bytes is not None:
            statement = statement.where(
                RecipeSearchDocument.resident_memory_bytes <= max_memory_bytes
            )
        if max_installed_bytes is not None:
            statement = statement.where(
                RecipeSearchDocument.installed_bytes <= max_installed_bytes
            )
        if query is not None:
            if (
                self.database.bind is not None
                and self.database.bind.dialect.name == "postgresql"
            ):
                statement = statement.where(
                    func.to_tsvector("simple", RecipeSearchDocument.search_text).op(
                        "@@"
                    )(func.websearch_to_tsquery("simple", query))
                )
            else:
                statement = statement.where(
                    RecipeSearchDocument.search_text.ilike(f"%{query}%")
                )
        rows = self.database.execute(statement.limit(1000)).all()
        filtered = [
            row
            for row in rows
            if (capability is None or capability in row[3].capabilities)
            and (
                tested_node_count is None
                or tested_node_count in row[3].tested_node_counts
            )
        ]
        if sort == "newest":
            filtered.sort(
                key=lambda row: (row[2].published_at, row[2].id), reverse=True
            )
            key = lambda row: (row[2].published_at.isoformat(), row[2].id)
        elif sort == "title":
            filtered.sort(key=lambda row: (row[1].title.lower(), row[2].id))
            key = lambda row: (row[1].title.lower(), row[2].id)
        elif sort == "disk":
            filtered.sort(key=lambda row: (row[3].installed_bytes, row[2].id))
            key = lambda row: (row[3].installed_bytes, row[2].id)
        else:
            filtered.sort(key=lambda row: (row[3].resident_memory_bytes, row[2].id))
            key = lambda row: (row[3].resident_memory_bytes, row[2].id)
        decoded = _decode_cursor(cursor, sort)
        if decoded is not None:
            filtered = (
                [row for row in filtered if key(row) > decoded]
                if sort != "newest"
                else [row for row in filtered if key(row) < decoded]
            )
        page = filtered[: limit + 1]
        has_more = len(page) > limit
        page = page[:limit]
        items = tuple(PublishedRecipe(row[0], row[1], row[2]) for row in page)
        next_cursor = None
        if has_more and page:
            value, revision_id = key(page[-1])
            next_cursor = _encode_cursor(sort, value, revision_id)
        return SearchPage(items, next_cursor)
