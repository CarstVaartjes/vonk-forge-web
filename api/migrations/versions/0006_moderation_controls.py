"""Add reversible moderation controls and reports.

Revision ID: 0006_moderation_controls
Revises: 0005_immutable_publication
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_moderation_controls"
down_revision: str | None = "0005_immutable_publication"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("system_role", sa.String(32)))
    op.create_index("ix_users_system_role", "users", ["system_role"])
    op.add_column(
        "moderation_events",
        sa.Column("details", sa.JSON(), nullable=False, server_default="{}"),
    )
    op.add_column(
        "moderation_events",
        sa.Column("sequence", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index(
        "uq_moderation_revision_sequence",
        "moderation_events",
        ["revision_id", "sequence"],
        unique=True,
    )
    op.create_table(
        "publisher_moderation_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "publisher_id",
            sa.String(36),
            sa.ForeignKey("publishers.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "actor_user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("action", sa.String(32), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("publisher_id", "sequence"),
    )
    op.create_index(
        "ix_publisher_moderation_events_publisher_id",
        "publisher_moderation_events",
        ["publisher_id"],
    )
    op.create_index(
        "ix_publisher_moderation_events_actor_user_id",
        "publisher_moderation_events",
        ["actor_user_id"],
    )
    op.create_table(
        "moderation_reports",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "revision_id",
            sa.String(36),
            sa.ForeignKey("recipe_revisions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "reporter_user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
        ),
        sa.Column("source_digest", sa.String(64), nullable=False),
        sa.Column("category", sa.String(32), nullable=False),
        sa.Column("detail", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    for column in ("revision_id", "reporter_user_id", "source_digest"):
        op.create_index(
            f"ix_moderation_reports_{column}", "moderation_reports", [column]
        )
    dialect = op.get_bind().dialect.name
    tables = ("moderation_events", "publisher_moderation_events")
    if dialect == "postgresql":
        op.execute(
            "CREATE FUNCTION reject_moderation_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'moderation history is append-only'; END $$"
        )
        for table in tables:
            op.execute(
                f"CREATE TRIGGER {table}_append_only BEFORE UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION reject_moderation_mutation()"
            )
    elif dialect == "sqlite":
        for table in tables:
            for operation in ("UPDATE", "DELETE"):
                op.execute(
                    f"CREATE TRIGGER {table}_append_only_{operation.lower()} BEFORE {operation} ON {table} BEGIN SELECT RAISE(ABORT, 'moderation history is append-only'); END"
                )


def downgrade() -> None:
    dialect = op.get_bind().dialect.name
    tables = ("moderation_events", "publisher_moderation_events")
    if dialect == "postgresql":
        for table in tables:
            op.execute(f"DROP TRIGGER {table}_append_only ON {table}")
        op.execute("DROP FUNCTION reject_moderation_mutation()")
    elif dialect == "sqlite":
        for table in tables:
            for operation in ("update", "delete"):
                op.execute(f"DROP TRIGGER {table}_append_only_{operation}")
    op.drop_table("moderation_reports")
    op.drop_table("publisher_moderation_events")
    op.drop_index(
        "uq_moderation_revision_sequence",
        table_name="moderation_events",
    )
    op.drop_column("moderation_events", "sequence")
    op.drop_column("moderation_events", "details")
    op.drop_index("ix_users_system_role", table_name="users")
    op.drop_column("users", "system_role")
