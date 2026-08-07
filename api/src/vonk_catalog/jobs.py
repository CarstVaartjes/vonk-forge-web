from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import CatalogJob, RecipeDraft


def enqueue_draft_validation(database: Session, draft: RecipeDraft) -> CatalogJob:
    key = f"validate-draft:{draft.id}:{draft.version}:{draft.content_sha256}"
    existing = database.scalar(
        select(CatalogJob).where(CatalogJob.idempotency_key == key)
    )
    if existing is not None:
        return existing
    job = CatalogJob(
        kind="validate-draft",
        state="pending",
        payload={
            "draft_id": draft.id,
            "draft_version": draft.version,
            "content_sha256": draft.content_sha256,
        },
        idempotency_key=key,
        attempt=0,
    )
    database.add(job)
    database.flush()
    return job
