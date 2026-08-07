"""Create the public catalog foundation.

Revision ID: 0001_catalog_foundation
Revises:
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0001_catalog_foundation"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


json_document = sa.JSON().with_variant(sa.dialects.postgresql.JSONB(), "postgresql")


def timestamps() -> tuple[sa.Column, sa.Column]:
    return (
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("display_name", sa.String(160), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_table(
        "publishers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("slug", sa.String(63), nullable=False, unique=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("system_role", sa.String(32), unique=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("slug = lower(slug)", name="ck_publishers_lower_slug"),
    )
    op.create_table(
        "oauth_accounts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("email", sa.String(320)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("provider", "subject"),
    )
    op.create_index("ix_oauth_accounts_user_id", "oauth_accounts", ["user_id"])
    op.create_table(
        "publisher_memberships",
        sa.Column(
            "publisher_id",
            sa.String(36),
            sa.ForeignKey("publishers.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "role IN ('owner', 'editor', 'viewer')", name="ck_membership_role"
        ),
    )
    op.create_table(
        "source_bundles",
        sa.Column("sha256", sa.String(64), primary_key=True),
        sa.Column("media_type", sa.String(96), nullable=False),
        sa.Column("archive_bytes", sa.BigInteger, nullable=False),
        sa.Column("total_bytes", sa.BigInteger, nullable=False),
        sa.Column("file_count", sa.Integer, nullable=False),
        sa.Column("storage_key", sa.String(255), nullable=False, unique=True),
        sa.Column("manifest", json_document, nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("length(sha256) = 64", name="ck_source_bundle_digest"),
        sa.CheckConstraint(
            "archive_bytes > 0 AND total_bytes >= 0 AND file_count >= 1",
            name="ck_source_bundle_sizes",
        ),
    )
    op.create_table(
        "recipes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "publisher_id",
            sa.String(36),
            sa.ForeignKey("publishers.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("slug", sa.String(63), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("state", sa.String(24), nullable=False, server_default="active"),
        *timestamps(),
        sa.UniqueConstraint("publisher_id", "slug"),
        sa.CheckConstraint("slug = lower(slug)", name="ck_recipes_lower_slug"),
    )
    op.create_index("ix_recipes_publisher_id", "recipes", ["publisher_id"])
    op.create_table(
        "recipe_drafts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "recipe_id",
            sa.String(36),
            sa.ForeignKey("recipes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("document", json_document, nullable=False),
        sa.Column("content_sha256", sa.String(64), nullable=False),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("state", sa.String(24), nullable=False, server_default="private"),
        *timestamps(),
        sa.CheckConstraint("version >= 1", name="ck_draft_version"),
    )
    op.create_index("ix_recipe_drafts_recipe_id", "recipe_drafts", ["recipe_id"])
    op.create_table(
        "recipe_revisions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "recipe_id",
            sa.String(36),
            sa.ForeignKey("recipes.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("revision_number", sa.Integer, nullable=False),
        sa.Column("content_sha256", sa.String(64), nullable=False),
        sa.Column("schema_version", sa.Integer, nullable=False),
        sa.Column("document", json_document, nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("recipe_id", "revision_number"),
        sa.UniqueConstraint("recipe_id", "content_sha256"),
        sa.CheckConstraint("revision_number >= 1", name="ck_revision_number"),
        sa.CheckConstraint("schema_version >= 1", name="ck_revision_schema"),
    )
    op.create_index("ix_recipe_revisions_recipe_id", "recipe_revisions", ["recipe_id"])
    op.create_index(
        "ix_recipe_revisions_published", "recipe_revisions", ["published_at", "id"]
    )
    op.create_index(
        "ix_recipe_revisions_content_hash", "recipe_revisions", ["content_sha256"]
    )
    op.create_table(
        "revision_source_bundles",
        sa.Column(
            "revision_id",
            sa.String(36),
            sa.ForeignKey("recipe_revisions.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "source_bundle_sha256",
            sa.String(64),
            sa.ForeignKey("source_bundles.sha256", ondelete="RESTRICT"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_revision_source_bundles_source_bundle_sha256",
        "revision_source_bundles",
        ["source_bundle_sha256"],
    )
    op.create_table(
        "validation_results",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "draft_id",
            sa.String(36),
            sa.ForeignKey("recipe_drafts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("draft_version", sa.Integer, nullable=False),
        sa.Column("content_sha256", sa.String(64), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("checks", json_document, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("draft_id", "draft_version", "content_sha256"),
        sa.CheckConstraint("draft_version >= 1", name="ck_validation_draft_version"),
    )
    op.create_index(
        "ix_validation_results_draft_id", "validation_results", ["draft_id"]
    )
    op.create_table(
        "test_reports",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "draft_id",
            sa.String(36),
            sa.ForeignKey("recipe_drafts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("recipe_sha256", sa.String(64), nullable=False),
        sa.Column("report", json_document, nullable=False),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_test_reports_draft_id", "test_reports", ["draft_id"])
    op.create_index("ix_test_reports_recipe_sha256", "test_reports", ["recipe_sha256"])
    op.create_table(
        "recipe_forks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "recipe_id",
            sa.String(36),
            sa.ForeignKey("recipes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "source_revision_id",
            sa.String(36),
            sa.ForeignKey("recipe_revisions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("recipe_id", "source_revision_id"),
    )
    op.create_index("ix_recipe_forks_recipe_id", "recipe_forks", ["recipe_id"])
    op.create_index(
        "ix_recipe_forks_source_revision_id", "recipe_forks", ["source_revision_id"]
    )
    op.create_table(
        "moderation_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "revision_id",
            sa.String(36),
            sa.ForeignKey("recipe_revisions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "actor_user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
        ),
        sa.Column("action", sa.String(32), nullable=False),
        sa.Column("reason", sa.Text, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_moderation_events_revision_id", "moderation_events", ["revision_id"]
    )
    op.create_index(
        "ix_moderation_events_actor_user_id", "moderation_events", ["actor_user_id"]
    )
    op.create_table(
        "catalog_jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("kind", sa.String(48), nullable=False),
        sa.Column("state", sa.String(24), nullable=False, server_default="pending"),
        sa.Column("payload", json_document, nullable=False),
        sa.Column("idempotency_key", sa.String(128), nullable=False, unique=True),
        sa.Column("lease_until", sa.DateTime(timezone=True)),
        sa.Column("attempt", sa.Integer, nullable=False, server_default="0"),
        sa.Column("problem_code", sa.String(128)),
        *timestamps(),
        sa.CheckConstraint("attempt >= 0", name="ck_catalog_job_attempt"),
    )
    op.create_index("ix_catalog_jobs_lease_until", "catalog_jobs", ["lease_until"])
    op.create_index(
        "ix_catalog_jobs_claim", "catalog_jobs", ["state", "lease_until", "created_at"]
    )


def downgrade() -> None:
    for table in (
        "catalog_jobs",
        "moderation_events",
        "recipe_forks",
        "test_reports",
        "validation_results",
        "revision_source_bundles",
        "recipe_revisions",
        "recipe_drafts",
        "recipes",
        "source_bundles",
        "publisher_memberships",
        "oauth_accounts",
        "publishers",
        "users",
    ):
        op.drop_table(table)
