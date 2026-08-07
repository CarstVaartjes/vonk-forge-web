"""Add publisher invitations and append-only audit history.

Revision ID: 0003_publisher_security
Revises: 0002_browser_auth
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_publisher_security"
down_revision: str | None = "0002_browser_auth"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "publisher_invitations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "publisher_id",
            sa.String(36),
            sa.ForeignKey("publishers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "invited_by_user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("token_digest", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "accepted_by_user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
        ),
        sa.Column("accepted_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "role IN ('owner', 'editor', 'viewer')", name="ck_publisher_invitation_role"
        ),
    )
    for column in (
        "publisher_id",
        "invited_by_user_id",
        "expires_at",
        "accepted_by_user_id",
    ):
        op.create_index(
            f"ix_publisher_invitations_{column}", "publisher_invitations", [column]
        )
    op.create_table(
        "publisher_audit_events",
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
            sa.ForeignKey("users.id", ondelete="SET NULL"),
        ),
        sa.Column("action", sa.String(48), nullable=False),
        sa.Column(
            "subject_user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
        ),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    for column in ("publisher_id", "actor_user_id", "subject_user_id"):
        op.create_index(
            f"ix_publisher_audit_events_{column}", "publisher_audit_events", [column]
        )


def downgrade() -> None:
    op.drop_table("publisher_audit_events")
    op.drop_table("publisher_invitations")
