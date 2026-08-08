from __future__ import annotations

from collections.abc import Callable, Iterator

from fastapi import APIRouter, Depends, Header, Query, Response
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from .contracts import contract_path
from .models import (
    Publisher,
    Recipe,
    RecipeDraft,
    RecipeRevision,
    RevisionSourceBundle,
    ValidationResult,
)
from .moderation import ModerationService
from .problems import Problem
from .repositories import CatalogRepository, PublishedRecipe
from .search import SearchService
from .source_bundles import SourceBundleError, SourceBundleStore

SessionProvider = Callable[[], Session]


def build_public_router(
    session_provider: SessionProvider | None, source_bundles: SourceBundleStore
) -> APIRouter:
    router = APIRouter(prefix="/v1")

    def database_session() -> Iterator[Session]:
        if session_provider is None:
            raise Problem(
                503,
                "catalog.database_unavailable",
                "Catalog database unavailable",
                "The catalog database is not ready.",
            )
        with session_provider() as session:
            yield session

    @router.get("/recipes")
    def list_recipes(
        q: str | None = Query(default=None, min_length=1, max_length=120),
        publisher: str | None = Query(default=None, max_length=63),
        official: bool | None = Query(default=None),
        runtime: str | None = Query(default=None, max_length=64),
        workload_family: str | None = Query(default=None, max_length=64),
        capability: str | None = Query(default=None, max_length=64),
        topology: str | None = Query(default=None, pattern="^(single|gang)$"),
        tested_node_count: int | None = Query(default=None, ge=1, le=16),
        min_nodes: int | None = Query(default=None, ge=1, le=16),
        max_nodes: int | None = Query(default=None, ge=1, le=16),
        max_memory_bytes: int | None = Query(default=None, ge=1),
        max_installed_bytes: int | None = Query(default=None, ge=1),
        sort: str = Query(default="newest", pattern="^(newest|title|disk|memory)$"),
        cursor: str | None = Query(default=None, max_length=512),
        limit: int = Query(default=20, ge=1, le=100),
        session: Session = Depends(database_session),
    ) -> dict[str, object]:
        page = SearchService(session).search(
            query=q,
            publisher=publisher,
            official=official,
            runtime=runtime,
            workload_family=workload_family,
            capability=capability,
            topology=topology,
            min_nodes=min_nodes,
            max_nodes=max_nodes,
            tested_node_count=tested_node_count,
            max_memory_bytes=max_memory_bytes,
            max_installed_bytes=max_installed_bytes,
            sort=sort,
            cursor=cursor,
            limit=limit,
        )
        visible = [item for item in page.items if _visible(session, item)]
        return {
            "items": [
                _summary(item, _warning(session, item), _facts(session, item))
                for item in visible
            ],
            "next_cursor": page.next_cursor,
        }

    @router.get("/recipes/{publisher}/{slug}")
    def recipe_detail(
        publisher: str,
        slug: str,
        session: Session = Depends(database_session),
    ) -> dict[str, object]:
        item = CatalogRepository(session).latest(publisher, slug)
        if item is None or not _visible(session, item):
            raise _not_found()
        return {
            **_summary(item, _warning(session, item), _facts(session, item)),
            "latest_revision": _revision(item),
        }

    @router.get(
        "/recipes/{publisher}/{slug}/revisions/{revision_number}",
        response_model=None,
    )
    def recipe_revision(
        publisher: str,
        slug: str,
        revision_number: int,
        response: Response,
        if_none_match: str | None = Header(default=None),
        session: Session = Depends(database_session),
    ) -> dict[str, object] | Response:
        item = CatalogRepository(session).revision(publisher, slug, revision_number)
        if item is None or not _visible(session, item):
            raise _not_found()
        return _immutable_revision(item, response, if_none_match)

    @router.get(
        "/recipes/{publisher}/{slug}/revisions/sha256/{content_sha256}",
        response_model=None,
    )
    def recipe_revision_by_hash(
        publisher: str,
        slug: str,
        content_sha256: str,
        response: Response,
        if_none_match: str | None = Header(default=None),
        session: Session = Depends(database_session),
    ) -> dict[str, object] | Response:
        if len(content_sha256) != 64 or any(
            character not in "0123456789abcdef" for character in content_sha256
        ):
            raise _not_found()
        item = CatalogRepository(session).revision_by_hash(
            publisher, slug, content_sha256
        )
        if item is None or not _visible(session, item):
            raise _not_found()
        return _immutable_revision(item, response, if_none_match)

    @router.get("/schemas/recipe/v1")
    def recipe_schema(response: Response) -> dict[str, object]:
        response.headers["Cache-Control"] = "public, max-age=3600"
        import json

        return json.loads(contract_path("recipe", "v1.schema.json").read_text())

    @router.get("/source-bundles/{sha256}", response_model=None)
    def download_source_bundle(
        sha256: str, session: Session = Depends(database_session)
    ) -> FileResponse:
        if len(sha256) != 64 or any(
            character not in "0123456789abcdef" for character in sha256
        ):
            raise _not_found()
        published = session.execute(
            select(Publisher, Recipe, RecipeRevision)
            .join(Recipe, Recipe.publisher_id == Publisher.id)
            .join(RecipeRevision, RecipeRevision.recipe_id == Recipe.id)
            .join(
                RevisionSourceBundle,
                RevisionSourceBundle.revision_id == RecipeRevision.id,
            )
            .where(
                RevisionSourceBundle.source_bundle_sha256 == sha256,
                Recipe.state == "active",
            )
        ).first()
        if published is None:
            raise _not_found()
        item = PublishedRecipe(published[0], published[1], published[2])
        if not _visible(session, item):
            raise _not_found()
        try:
            stored = source_bundles.get(sha256)
        except SourceBundleError:
            raise _not_found() from None
        return FileResponse(
            stored.path,
            media_type="application/vnd.vonk-forge.source-bundle.v1+tar",
            headers={
                "Cache-Control": "public, max-age=31536000, immutable",
                "ETag": f'"sha256:{sha256}"',
                "Content-Disposition": f'attachment; filename="{sha256}.tar"',
            },
        )

    return router


def _not_found() -> Problem:
    return Problem(
        404,
        "catalog.not_found",
        "Recipe not found",
        "The requested published recipe does not exist.",
    )


def _summary(
    item: PublishedRecipe,
    warning: str | None = None,
    facts: dict[str, object] | None = None,
) -> dict[str, object]:
    document = item.revision.document
    profiles = document.get("deployment_profiles", [])
    role_resources = [
        role.get("resources", {})
        for profile in profiles
        if isinstance(profile, dict)
        for role in profile.get("roles", [])
        if isinstance(role, dict)
    ]
    disk_fields = (
        "image_bytes",
        "artifact_bytes",
        "staging_bytes",
        "cache_bytes",
        "rollback_bytes",
        "safety_margin_bytes",
    )
    disk = [
        sum(int(resources.get("disk", {}).get(field, 0)) for field in disk_fields)
        for resources in role_resources
        if isinstance(resources, dict)
    ]
    memory = [
        int(resources.get("memory", {}).get("startup_peak_bytes", 0))
        for resources in role_resources
        if isinstance(resources, dict)
    ]
    return {
        "publisher": item.publisher.slug,
        "slug": item.recipe.slug,
        "title": item.recipe.title,
        "official": item.publisher.system_role == "official",
        "revision_number": item.revision.revision_number,
        "recipe_id": item.recipe.id,
        "revision_id": item.revision.id,
        "content_sha256": item.revision.content_sha256,
        "published_at": item.revision.published_at.isoformat(),
        "runtime": document.get("runtime"),
        "build": document.get("build"),
        "artifacts": document.get("artifacts"),
        "provenance": document.get("provenance"),
        "workload": document.get("workload"),
        "deployment_profiles": profiles,
        "capacity": {
            "profile_node_counts": sorted(
                {
                    int(profile["node_count"])
                    for profile in profiles
                    if isinstance(profile, dict) and "node_count" in profile
                }
            ),
            "maximum_installed_bytes_per_node": max(disk, default=0),
            "maximum_runtime_memory_bytes_per_node": max(memory, default=0),
        },
        "moderation_warning": warning,
        "facts": facts,
        "import": {
            "uri": (
                f"vonk://catalog/{item.publisher.slug}/{item.recipe.slug}"
                f"@sha256:{item.revision.content_sha256}"
            ),
            "instruction": (
                "Open this recipe in your local Vonk Forge and review its exact "
                "sizing before import."
            ),
        },
    }


def _visible(session: Session, item: PublishedRecipe) -> bool:
    return ModerationService(session).revision_visible(
        item.revision.id, item.publisher.id
    )


def _warning(session: Session, item: PublishedRecipe) -> str | None:
    return ModerationService(session).revision_state(item.revision.id).warning


def _facts(session: Session, item: PublishedRecipe) -> dict[str, object]:
    validation = session.scalar(
        select(ValidationResult)
        .join(RecipeDraft, RecipeDraft.id == ValidationResult.draft_id)
        .where(
            RecipeDraft.recipe_id == item.recipe.id,
            ValidationResult.content_sha256 == item.revision.content_sha256,
        )
        .order_by(ValidationResult.created_at.desc())
    )
    checks = [] if validation is None else validation.checks
    source_observed = any(
        check.get("code") == "source.bundle_verified" and check.get("passed") is True
        for check in checks
    )
    publisher_tested = any(
        check.get("code") == "evidence.publisher_submitted_accepted"
        and check.get("passed") is True
        for check in checks
    )
    return {
        "declared": True,
        "source_bundle_observed": source_observed,
        "publisher_tested": publisher_tested,
        "publisher_tested_label": "Publisher-submitted; not Vonk-certified",
        "vonk_verified": False,
        "last_validation": (
            None if validation is None else validation.created_at.isoformat()
        ),
    }


def _revision(item: PublishedRecipe) -> dict[str, object]:
    return {
        "publisher": item.publisher.slug,
        "slug": item.recipe.slug,
        "revision_number": item.revision.revision_number,
        "recipe_id": item.recipe.id,
        "revision_id": item.revision.id,
        "content_sha256": item.revision.content_sha256,
        "schema_version": item.revision.schema_version,
        "published_at": item.revision.published_at.isoformat(),
        "document": item.revision.document,
    }


def _immutable_revision(
    item: PublishedRecipe, response: Response, if_none_match: str | None
) -> dict[str, object] | Response:
    etag = f'"sha256:{item.revision.content_sha256}"'
    headers = {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "ETag": etag,
    }
    if if_none_match == etag:
        return Response(status_code=304, headers=headers)
    response.headers.update(headers)
    return _revision(item)
