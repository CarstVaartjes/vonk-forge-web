"""Add private draft validation and upload idempotency.

Revision ID: 0004_private_drafts
Revises: 0003_publisher_security
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_private_drafts"
down_revision: str | None = "0003_publisher_security"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "recipe_drafts",
        sa.Column(
            "validation_problems",
            sa.JSON(),
            nullable=False,
            server_default="[]",
        ),
    )
    op.create_table(
        "draft_upload_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "publisher_id",
            sa.String(36),
            sa.ForeignKey("publishers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("content_sha256", sa.String(64), nullable=False),
        sa.Column(
            "draft_id",
            sa.String(36),
            sa.ForeignKey("recipe_drafts.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("publisher_id", "idempotency_key"),
    )
    for column in ("publisher_id", "user_id", "draft_id"):
        op.create_index(
            f"ix_draft_upload_requests_{column}",
            "draft_upload_requests",
            [column],
        )


def downgrade() -> None:
    op.drop_table("draft_upload_requests")
    op.drop_column("recipe_drafts", "validation_problems")
