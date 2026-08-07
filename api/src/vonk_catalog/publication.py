from __future__ import annotations

import copy
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .canonical import content_sha256
from .drafts import DraftService
from .jobs import enqueue_draft_validation
from .models import (
    CatalogJob,
    PublicationRequest,
    Publisher,
    Recipe,
    RecipeDraft,
    RecipeFork,
    RecipeRevision,
    ValidationResult,
)
from .problems import Problem
from .publishers import PublisherService

Clock = Callable[[], datetime]


def _now() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True, slots=True)
class Published:
    revision: RecipeRevision
    official: bool


class PublicationService:
    def __init__(self, database: Session, *, clock: Clock = _now) -> None:
        self.database = database
        self.clock = clock

    @staticmethod
    def _key(value: str) -> str:
        if not value.isascii() or not 1 <= len(value) <= 128:
            raise Problem(
                422,
                "publication.idempotency_key_invalid",
                "Publication identifier is invalid",
                "Use a stable 1-128 character ASCII identifier.",
            )
        return value

    def request_validation(
        self, user_id: str, publisher_slug: str, draft_id: str
    ) -> CatalogJob:
        PublisherService(self.database).require_role(user_id, publisher_slug, "editor")
        draft = DraftService(self.database).get(user_id, publisher_slug, draft_id)
        job = enqueue_draft_validation(self.database, draft)
        draft.state = "validating"
        self.database.flush()
        return job

    def publish(
        self,
        user_id: str,
        publisher_slug: str,
        draft_id: str,
        *,
        idempotency_key: str,
    ) -> Published:
        key = self._key(idempotency_key)
        publisher = PublisherService(self.database).require_role(
            user_id, publisher_slug, "editor"
        )
        draft = DraftService(self.database).get(user_id, publisher_slug, draft_id)
        self.database.refresh(draft, with_for_update=True)
        canonical_hash = content_sha256(draft.document)
        if canonical_hash != draft.content_sha256:
            raise Problem(
                409,
                "publication.draft_hash_mismatch",
                "Draft integrity check failed",
                "Save the draft again before validation.",
            )
        previous = self.database.scalar(
            select(PublicationRequest).where(
                PublicationRequest.publisher_id == publisher.id,
                PublicationRequest.idempotency_key == key,
            )
        )
        if previous is not None:
            if previous.content_sha256 != canonical_hash:
                raise Problem(
                    409,
                    "publication.idempotency_conflict",
                    "Publication identifier was already used",
                    "Retry the original publication or choose a new identifier.",
                )
            revision = self.database.get(RecipeRevision, previous.revision_id)
            if revision is None:
                raise Problem(
                    409,
                    "publication.history_inconsistent",
                    "Publication history is inconsistent",
                    "Contact Vonk Forge support with the request identifier.",
                )
            return Published(revision, publisher.system_role == "official")
        validation = self.database.scalar(
            select(ValidationResult).where(
                ValidationResult.draft_id == draft.id,
                ValidationResult.draft_version == draft.version,
                ValidationResult.content_sha256 == canonical_hash,
                ValidationResult.status == "passed",
            )
        )
        if validation is None:
            raise Problem(
                409,
                "publication.validation_required",
                "Current draft is not validated",
                "Validate this exact draft version before publishing.",
            )
        existing = self.database.scalar(
            select(RecipeRevision).where(
                RecipeRevision.recipe_id == draft.recipe_id,
                RecipeRevision.content_sha256 == canonical_hash,
            )
        )
        if existing is not None:
            raise Problem(
                409,
                "publication.already_published",
                "Recipe content is already published",
                "Use the immutable existing revision.",
            )
        recipe = self.database.get(Recipe, draft.recipe_id)
        assert recipe is not None
        self.database.refresh(recipe, with_for_update=True)
        next_number = (
            int(
                self.database.scalar(
                    select(func.max(RecipeRevision.revision_number)).where(
                        RecipeRevision.recipe_id == draft.recipe_id
                    )
                )
                or 0
            )
            + 1
        )
        revision = RecipeRevision(
            recipe_id=draft.recipe_id,
            revision_number=next_number,
            content_sha256=canonical_hash,
            schema_version=int(draft.document["schema_version"]),
            document=copy.deepcopy(draft.document),
            published_at=self.clock(),
        )
        self.database.add(revision)
        self.database.flush()
        self.database.add(
            PublicationRequest(
                publisher_id=publisher.id,
                user_id=user_id,
                idempotency_key=key,
                content_sha256=canonical_hash,
                revision_id=revision.id,
            )
        )
        metadata = draft.document.get("metadata")
        if isinstance(metadata, dict) and isinstance(metadata.get("title"), str):
            recipe.title = metadata["title"]
        recipe.state = "active"
        draft.state = "published"
        self.database.flush()
        return Published(revision, publisher.system_role == "official")

    def fork(
        self,
        user_id: str,
        destination_publisher: str,
        source_revision_id: str,
        *,
        new_slug: str,
        idempotency_key: str,
    ) -> RecipeDraft:
        PublisherService(self.database).require_role(
            user_id, destination_publisher, "editor"
        )
        source = self.database.get(RecipeRevision, source_revision_id)
        if source is None:
            raise Problem(
                404,
                "publication.source_not_found",
                "Source revision not found",
                "Choose an existing immutable public revision.",
            )
        recipe = self.database.get(Recipe, source.recipe_id)
        assert recipe is not None
        source_publisher = self.database.get(Publisher, recipe.publisher_id)
        assert source_publisher is not None
        document = copy.deepcopy(source.document)
        identity = document.get("identity")
        provenance = document.get("provenance")
        if not isinstance(identity, dict) or not isinstance(provenance, dict):
            raise Problem(
                409,
                "publication.source_invalid",
                "Source revision is invalid",
                "The source cannot be represented by the current recipe contract.",
            )
        identity["publisher"] = destination_publisher
        identity["slug"] = new_slug
        reference = (
            f"vonk://{source_publisher.slug}/{recipe.slug}/revisions/"
            f"{source.revision_number}#sha256={source.content_sha256}"
        )
        provenance["source_kind"] = "fork"
        provenance["source_reference"] = reference
        attribution = provenance.get("attribution")
        attribution = attribution if isinstance(attribution, list) else []
        source_credit = f"Forked from {source_publisher.slug}/{recipe.slug} revision {source.revision_number}"
        provenance["attribution"] = (attribution + [source_credit])[-32:]
        draft = DraftService(self.database).create(
            user_id,
            destination_publisher,
            document,
            idempotency_key=idempotency_key,
        )
        link = self.database.scalar(
            select(RecipeFork).where(
                RecipeFork.recipe_id == draft.recipe_id,
                RecipeFork.source_revision_id == source.id,
            )
        )
        if link is None:
            self.database.add(
                RecipeFork(
                    recipe_id=draft.recipe_id,
                    source_revision_id=source.id,
                )
            )
            self.database.flush()
        return draft
