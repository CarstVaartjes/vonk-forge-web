from alembic import command
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect

EXPECTED_TABLES = {
    "alembic_version",
    "catalog_jobs",
    "draft_upload_requests",
    "browser_sessions",
    "moderation_events",
    "oauth_accounts",
    "oauth_flows",
    "publisher_memberships",
    "publisher_invitations",
    "publisher_audit_events",
    "publishers",
    "recipe_drafts",
    "recipe_forks",
    "recipe_revisions",
    "recipes",
    "test_reports",
    "users",
    "validation_results",
}


def test_catalog_has_one_migration_head(alembic_config) -> None:
    assert ScriptDirectory.from_config(alembic_config).get_heads() == [
        "0004_private_drafts"
    ]


def test_catalog_migration_upgrades_and_downgrades(alembic_config) -> None:
    command.upgrade(alembic_config, "head")
    engine = create_engine(alembic_config.get_main_option("sqlalchemy.url"))
    assert set(inspect(engine).get_table_names()) == EXPECTED_TABLES

    command.downgrade(alembic_config, "base")
    assert inspect(engine).get_table_names() == ["alembic_version"]
    engine.dispose()
