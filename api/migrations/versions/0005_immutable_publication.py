"""Add publication idempotency and database revision immutability.

Revision ID: 0005_immutable_publication
Revises: 0004_private_drafts
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_immutable_publication"
down_revision: str | None = "0004_private_drafts"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "publication_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "publisher_id",
            sa.String(36),
            sa.ForeignKey("publishers.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("content_sha256", sa.String(64), nullable=False),
        sa.Column(
            "revision_id",
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
        sa.UniqueConstraint("publisher_id", "idempotency_key"),
    )
    for column in ("publisher_id", "user_id", "revision_id"):
        op.create_index(
            f"ix_publication_requests_{column}", "publication_requests", [column]
        )
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        op.execute(
            """
            CREATE FUNCTION reject_recipe_revision_mutation() RETURNS trigger
            LANGUAGE plpgsql AS $$ BEGIN
              RAISE EXCEPTION 'published recipe revisions are immutable';
            END $$
            """
        )
        op.execute(
            """
            CREATE TRIGGER recipe_revisions_immutable
            BEFORE UPDATE OR DELETE ON recipe_revisions
            FOR EACH ROW EXECUTE FUNCTION reject_recipe_revision_mutation()
            """
        )
    elif dialect == "sqlite":
        op.execute(
            """
            CREATE TRIGGER recipe_revisions_immutable_update
            BEFORE UPDATE ON recipe_revisions BEGIN
              SELECT RAISE(ABORT, 'published recipe revisions are immutable');
            END
            """
        )
        op.execute(
            """
            CREATE TRIGGER recipe_revisions_immutable_delete
            BEFORE DELETE ON recipe_revisions BEGIN
              SELECT RAISE(ABORT, 'published recipe revisions are immutable');
            END
            """
        )


def downgrade() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        op.execute("DROP TRIGGER recipe_revisions_immutable ON recipe_revisions")
        op.execute("DROP FUNCTION reject_recipe_revision_mutation()")
    elif dialect == "sqlite":
        op.execute("DROP TRIGGER recipe_revisions_immutable_update")
        op.execute("DROP TRIGGER recipe_revisions_immutable_delete")
    op.drop_table("publication_requests")
