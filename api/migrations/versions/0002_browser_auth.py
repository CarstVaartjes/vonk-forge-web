"""Add OAuth flow and browser session state.

Revision ID: 0002_browser_auth
Revises: 0001_catalog_foundation
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_browser_auth"
down_revision: str | None = "0001_catalog_foundation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "oauth_flows",
        sa.Column("state_digest", sa.String(64), primary_key=True),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("code_verifier", sa.String(128), nullable=False),
        sa.Column("nonce", sa.String(128), nullable=False),
        sa.Column(
            "link_user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
        ),
        sa.Column(
            "return_to", sa.String(256), nullable=False, server_default="/workspace"
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "provider IN ('github', 'google')", name="ck_oauth_flow_provider"
        ),
    )
    op.create_index("ix_oauth_flows_provider", "oauth_flows", ["provider"])
    op.create_index("ix_oauth_flows_link_user_id", "oauth_flows", ["link_user_id"])
    op.create_index("ix_oauth_flows_expires_at", "oauth_flows", ["expires_at"])
    op.create_table(
        "browser_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_digest", sa.String(64), nullable=False, unique=True),
        sa.Column(
            "previous_session_id",
            sa.String(36),
            sa.ForeignKey("browser_sessions.id", ondelete="SET NULL"),
        ),
        sa.Column("ip_digest", sa.String(64), nullable=False),
        sa.Column("user_agent_digest", sa.String(64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "last_used_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_browser_sessions_user_id", "browser_sessions", ["user_id"])
    op.create_index(
        "ix_browser_sessions_previous_session_id",
        "browser_sessions",
        ["previous_session_id"],
    )
    op.create_index(
        "ix_browser_sessions_expires_at", "browser_sessions", ["expires_at"]
    )


def downgrade() -> None:
    op.drop_table("browser_sessions")
    op.drop_table("oauth_flows")
