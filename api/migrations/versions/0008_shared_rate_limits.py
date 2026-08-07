"""Add shared fixed-window request-rate counters.

Revision ID: 0008_shared_rate_limits
Revises: 0007_recipe_search
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008_shared_rate_limits"
down_revision: str | None = "0007_recipe_search"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "request_rate_limit_buckets",
        sa.Column("key_digest", sa.String(64), primary_key=True),
        sa.Column("bucket_start", sa.BigInteger(), primary_key=True),
        sa.Column("request_count", sa.Integer(), nullable=False),
        sa.CheckConstraint("request_count >= 1", name="ck_rate_limit_count"),
    )
    op.create_index(
        "ix_request_rate_limit_buckets_start",
        "request_rate_limit_buckets",
        ["bucket_start"],
    )


def downgrade() -> None:
    op.drop_table("request_rate_limit_buckets")
