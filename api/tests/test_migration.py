from alembic import command
from alembic.script import ScriptDirectory
from sqlalchemy import BigInteger, create_engine, inspect, text

EXPECTED_TABLES = {
    "alembic_version",
    "catalog_jobs",
    "draft_upload_requests",
    "browser_sessions",
    "moderation_events",
    "moderation_reports",
    "oauth_accounts",
    "oauth_flows",
    "publisher_memberships",
    "publisher_invitations",
    "publisher_audit_events",
    "publication_requests",
    "publisher_moderation_events",
    "publishers",
    "recipe_drafts",
    "recipe_forks",
    "recipe_revisions",
    "recipe_search_documents",
    "request_rate_limit_buckets",
    "recipes",
    "test_reports",
    "users",
    "validation_results",
}


def test_catalog_has_one_migration_head(alembic_config) -> None:
    assert ScriptDirectory.from_config(alembic_config).get_heads() == [
        "0008_shared_rate_limits"
    ]


def test_catalog_migration_upgrades_and_downgrades(alembic_config) -> None:
    command.upgrade(alembic_config, "head")
    engine = create_engine(alembic_config.get_main_option("sqlalchemy.url"))
    assert set(inspect(engine).get_table_names()) == EXPECTED_TABLES
    rate_limit_columns = {
        column["name"]: column
        for column in inspect(engine).get_columns("request_rate_limit_buckets")
    }
    assert isinstance(rate_limit_columns["bucket_start"]["type"], BigInteger)
    with engine.connect() as connection:
        if engine.dialect.name == "postgresql":
            triggers = {
                row[0]
                for row in connection.execute(
                    text("SELECT tgname FROM pg_trigger WHERE NOT tgisinternal")
                )
            }
            assert "recipe_revisions_immutable" in triggers
        else:
            triggers = {
                row[0]
                for row in connection.execute(
                    text("SELECT name FROM sqlite_master WHERE type = 'trigger'")
                )
            }
            assert {
                "recipe_revisions_immutable_update",
                "recipe_revisions_immutable_delete",
            } <= triggers

    command.downgrade(alembic_config, "base")
    assert inspect(engine).get_table_names() == ["alembic_version"]
    engine.dispose()
