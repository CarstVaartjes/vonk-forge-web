from pathlib import Path

from vonk_catalog.db import build_engine, database_url_with_password


def test_database_password_can_come_from_a_secret_file(tmp_path: Path) -> None:
    secret = tmp_path / "password"
    secret.write_text("a password with spaces\n")

    result = database_url_with_password(
        "postgresql+psycopg://vonk@postgres:5432/vonk_catalog", secret
    )

    assert result.password == "a password with spaces"
    assert result.render_as_string(hide_password=True) == (
        "postgresql+psycopg://vonk:***@postgres:5432/vonk_catalog"
    )


def test_postgres_engine_has_bounded_pool_and_server_timeouts() -> None:
    engine = build_engine(
        "postgresql+psycopg://vonk:secret@database.invalid/vonk_catalog",
        pool_size=7,
        max_overflow=2,
        statement_timeout_ms=12_000,
        lock_timeout_ms=4_000,
        idle_transaction_timeout_ms=20_000,
    )

    assert engine.pool.size() == 7
    assert engine.pool._max_overflow == 2
    options = engine.dialect.create_connect_args(engine.url)[1]["options"]
    assert "statement_timeout=12000" in options
    assert "lock_timeout=4000" in options
    assert "idle_in_transaction_session_timeout=20000" in options
