"""Add typed recipe search projection and PostgreSQL indexes.

Revision ID: 0007_recipe_search
Revises: 0006_moderation_controls
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_recipe_search"
down_revision: str | None = "0006_moderation_controls"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

json_document = sa.JSON().with_variant(sa.dialects.postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "recipe_search_documents",
        sa.Column(
            "revision_id",
            sa.String(36),
            sa.ForeignKey("recipe_revisions.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("search_text", sa.Text(), nullable=False),
        sa.Column("runtime_family", sa.String(64), nullable=False),
        sa.Column("workload_family", sa.String(64), nullable=False),
        sa.Column("topology_kind", sa.String(16), nullable=False),
        sa.Column("min_nodes", sa.Integer(), nullable=False),
        sa.Column("max_nodes", sa.Integer(), nullable=False),
        sa.Column("tested_node_counts", json_document, nullable=False),
        sa.Column("installed_bytes", sa.BigInteger(), nullable=False),
        sa.Column("resident_memory_bytes", sa.BigInteger(), nullable=False),
        sa.Column("capabilities", json_document, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    for column in (
        "runtime_family",
        "workload_family",
        "topology_kind",
        "min_nodes",
        "max_nodes",
        "installed_bytes",
        "resident_memory_bytes",
    ):
        op.create_index(
            f"ix_recipe_search_documents_{column}", "recipe_search_documents", [column]
        )
    op.create_index(
        "ix_recipe_search_documents_newest",
        "recipe_search_documents",
        ["created_at", "revision_id"],
    )
    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            """
            INSERT INTO recipe_search_documents
              (revision_id, search_text, runtime_family, workload_family,
               topology_kind, min_nodes, max_nodes, tested_node_counts,
               installed_bytes, resident_memory_bytes, capabilities, created_at)
            SELECT rr.id,
                   concat_ws(' ', p.slug, p.name, r.slug, r.title, rr.document::text),
                   rr.document #>> '{runtime,family}',
                   rr.document #>> '{workload,family}',
                   rr.document #>> '{topology,kind}',
                   (rr.document #>> '{topology,min_nodes}')::integer,
                   (rr.document #>> '{topology,max_nodes}')::integer,
                   rr.document #> '{topology,tested_node_counts}',
                   (rr.document #>> '{resources,per_node,installed_bytes}')::bigint,
                   (rr.document #>> '{resources,per_node,resident_memory_bytes}')::bigint,
                   rr.document #> '{workload,capabilities}',
                   rr.published_at
            FROM recipe_revisions rr
            JOIN recipes r ON r.id = rr.recipe_id
            JOIN publishers p ON p.id = r.publisher_id
            ON CONFLICT (revision_id) DO NOTHING
            """
        )
        op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
        op.execute(
            "ALTER TABLE recipe_search_documents ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', search_text)) STORED"
        )
        op.execute(
            "CREATE INDEX ix_recipe_search_documents_vector ON recipe_search_documents USING GIN (search_vector)"
        )
        op.execute(
            "CREATE INDEX ix_recipe_search_documents_trigram ON recipe_search_documents USING GIN (search_text gin_trgm_ops)"
        )
        op.execute(
            "CREATE INDEX ix_recipe_search_documents_capabilities ON recipe_search_documents USING GIN (capabilities jsonb_path_ops)"
        )


def downgrade() -> None:
    op.drop_table("recipe_search_documents")
