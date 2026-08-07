from __future__ import annotations

import copy
from collections.abc import Mapping

from sqlalchemy import select
from sqlalchemy.orm import Session

from .canonical import content_sha256, parse_json
from .contracts import recipe_problems
from .models import (
    DraftUploadRequest,
    Recipe,
    RecipeDraft,
    TestReport,
)
from .problems import Problem
from .publishers import PublisherService

MAX_BODY_BYTES = 1_048_576
MAX_DEPTH = 20
MAX_NODES = 20_000
MAX_ARRAY_ITEMS = 256
MAX_STRING_BYTES = 65_536


def _check_structure(value: object) -> None:
    nodes = 0

    def walk(current: object, depth: int) -> None:
        nonlocal nodes
        nodes += 1
        if nodes > MAX_NODES or depth > MAX_DEPTH:
            raise Problem(
                413,
                "draft.structure_too_complex",
                "Upload is too complex",
                "Reduce JSON nesting or field count.",
            )
        if isinstance(current, str):
            if len(current.encode("utf-8")) > MAX_STRING_BYTES:
                raise Problem(
                    413,
                    "draft.string_too_large",
                    "Upload string is too large",
                    "Reduce individual text fields.",
                )
        elif isinstance(current, list):
            if len(current) > MAX_ARRAY_ITEMS:
                raise Problem(
                    413,
                    "draft.array_too_large",
                    "Upload array is too large",
                    "Reduce array items.",
                )
            for item in current:
                walk(item, depth + 1)
        elif isinstance(current, dict):
            for key, item in current.items():
                if len(key) > 128:
                    raise Problem(
                        413,
                        "draft.field_too_large",
                        "Upload field name is too large",
                        "Reduce JSON field names.",
                    )
                walk(item, depth + 1)

    walk(value, 0)


def decode_upload(body: bytes, content_type: str | None) -> dict[str, object]:
    media_type = (content_type or "").split(";", 1)[0].strip().lower()
    if media_type != "application/json":
        raise Problem(
            415,
            "draft.content_type_invalid",
            "JSON upload required",
            "Upload a JSON document; archives and multipart bodies are not accepted.",
        )
    if len(body) > MAX_BODY_BYTES:
        raise Problem(
            413,
            "draft.body_too_large",
            "Upload is too large",
            "The maximum upload size is 1 MiB.",
        )
    try:
        value = parse_json(body)
    except (UnicodeDecodeError, ValueError) as error:
        raise Problem(
            400,
            "draft.json_invalid",
            "Upload JSON is invalid",
            "Use UTF-8 JSON without duplicate keys or floating-point values.",
        ) from error
    _check_structure(value)
    if (
        not isinstance(value, dict)
        or "recipe" not in value
        or not set(value) <= {"recipe", "test_report"}
    ):
        raise Problem(
            422,
            "draft.envelope_invalid",
            "Upload envelope is invalid",
            "Send only recipe and optional test_report fields; container and model bytes are never accepted.",
        )
    if not isinstance(value["recipe"], dict) or (
        "test_report" in value and not isinstance(value["test_report"], dict)
    ):
        raise Problem(
            422,
            "draft.envelope_invalid",
            "Upload envelope is invalid",
            "Recipe and test_report must be JSON objects.",
        )
    return value


class DraftService:
    def __init__(self, database: Session) -> None:
        self.database = database

    def _normalize(
        self, publisher_slug: str, document: Mapping[str, object]
    ) -> dict[str, object]:
        normalized = copy.deepcopy(dict(document))
        identity = normalized.get("identity")
        if not isinstance(identity, dict):
            raise Problem(
                422,
                "draft.schema_invalid",
                "Recipe schema is invalid",
                "identity: a recipe identity object is required.",
            )
        identity["publisher"] = publisher_slug
        problems = recipe_problems(normalized)
        if problems:
            first = problems[0]
            raise Problem(
                422,
                "draft.schema_invalid",
                "Recipe schema is invalid",
                f"{first['path']}: {first['message']}",
            )
        return normalized

    def _draft(
        self, user_id: str, publisher_slug: str, draft_id: str, minimum: str
    ) -> RecipeDraft:
        publisher = PublisherService(self.database).require_role(
            user_id, publisher_slug, minimum
        )
        draft = self.database.scalar(
            select(RecipeDraft)
            .join(Recipe)
            .where(RecipeDraft.id == draft_id, Recipe.publisher_id == publisher.id)
        )
        if draft is None:
            raise Problem(
                404,
                "draft.not_found",
                "Draft not found",
                "No such private draft exists in this publisher.",
            )
        return draft

    def create(
        self,
        user_id: str,
        publisher_slug: str,
        document: Mapping[str, object],
        *,
        idempotency_key: str,
        test_report: Mapping[str, object] | None = None,
    ) -> RecipeDraft:
        publisher = PublisherService(self.database).require_role(
            user_id, publisher_slug, "editor"
        )
        if not idempotency_key.isascii() or not 1 <= len(idempotency_key) <= 128:
            raise Problem(
                422,
                "draft.idempotency_key_invalid",
                "Idempotency key is invalid",
                "Use a stable 1-128 character ASCII upload identifier.",
            )
        normalized = self._normalize(publisher.slug, document)
        digest = content_sha256(normalized)
        previous = self.database.scalar(
            select(DraftUploadRequest).where(
                DraftUploadRequest.publisher_id == publisher.id,
                DraftUploadRequest.idempotency_key == idempotency_key,
            )
        )
        if previous is not None:
            if previous.content_sha256 != digest:
                raise Problem(
                    409,
                    "draft.idempotency_conflict",
                    "Upload identifier was already used",
                    "Retry with the original recipe or choose a new idempotency key.",
                )
            draft = self.database.get(RecipeDraft, previous.draft_id)
            if draft is None:
                raise Problem(
                    409,
                    "draft.idempotency_conflict",
                    "Upload identifier is no longer reusable",
                    "Choose a new idempotency key.",
                )
            return draft
        identity = normalized["identity"]
        metadata = normalized["metadata"]
        assert isinstance(identity, dict) and isinstance(metadata, dict)
        slug = str(identity["slug"])
        recipe = self.database.scalar(
            select(Recipe).where(
                Recipe.publisher_id == publisher.id, Recipe.slug == slug
            )
        )
        if recipe is None:
            recipe = Recipe(
                publisher_id=publisher.id,
                slug=slug,
                title=str(metadata["title"]),
                state="draft",
            )
            self.database.add(recipe)
            self.database.flush()
        draft = RecipeDraft(
            recipe_id=recipe.id,
            document=normalized,
            content_sha256=digest,
            version=1,
            state="private",
            validation_problems=[],
        )
        self.database.add(draft)
        self.database.flush()
        self.database.add(
            DraftUploadRequest(
                publisher_id=publisher.id,
                user_id=user_id,
                idempotency_key=idempotency_key,
                content_sha256=digest,
                draft_id=draft.id,
            )
        )
        if test_report is not None:
            self.add_test_report(user_id, publisher_slug, draft.id, test_report)
        self.database.flush()
        return draft

    def get(self, user_id: str, publisher_slug: str, draft_id: str) -> RecipeDraft:
        return self._draft(user_id, publisher_slug, draft_id, "viewer")

    def update(
        self,
        user_id: str,
        publisher_slug: str,
        draft_id: str,
        document: Mapping[str, object],
        *,
        expected_version: int,
    ) -> RecipeDraft:
        draft = self._draft(user_id, publisher_slug, draft_id, "editor")
        self.database.refresh(draft, with_for_update=True)
        if draft.version != expected_version:
            raise Problem(
                412,
                "draft.version_conflict",
                "Draft changed",
                "Reload the draft and apply your edits to the latest version.",
            )
        normalized = self._normalize(publisher_slug, document)
        draft.document = normalized
        draft.content_sha256 = content_sha256(normalized)
        draft.validation_problems = []
        draft.version += 1
        draft.state = "private"
        self.database.flush()
        return draft

    def delete(
        self, user_id: str, publisher_slug: str, draft_id: str, *, expected_version: int
    ) -> None:
        draft = self._draft(user_id, publisher_slug, draft_id, "editor")
        self.database.refresh(draft, with_for_update=True)
        if draft.version != expected_version:
            raise Problem(
                412,
                "draft.version_conflict",
                "Draft changed",
                "Reload the draft before deleting it.",
            )
        self.database.delete(draft)
        self.database.flush()

    def add_test_report(
        self,
        user_id: str,
        publisher_slug: str,
        draft_id: str,
        report: Mapping[str, object],
    ) -> TestReport:
        draft = self._draft(user_id, publisher_slug, draft_id, "editor")
        row = TestReport(
            draft_id=draft.id,
            recipe_sha256=draft.content_sha256,
            report=copy.deepcopy(dict(report)),
        )
        self.database.add(row)
        self.database.flush()
        return row
