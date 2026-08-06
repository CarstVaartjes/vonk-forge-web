from pathlib import Path

from vonk_catalog.db import database_url_with_password


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
