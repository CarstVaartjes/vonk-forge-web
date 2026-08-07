from pathlib import Path

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import Session, sessionmaker


def build_engine(
    database_url: str | URL,
    *,
    pool_size: int = 5,
    max_overflow: int = 5,
    statement_timeout_ms: int = 15_000,
    lock_timeout_ms: int = 5_000,
    idle_transaction_timeout_ms: int = 30_000,
) -> Engine:
    url = make_url(database_url) if isinstance(database_url, str) else database_url
    arguments: dict[str, object] = {"pool_pre_ping": True}
    if url.get_backend_name() == "postgresql":
        options = " ".join(
            (
                f"-c statement_timeout={statement_timeout_ms}",
                f"-c lock_timeout={lock_timeout_ms}",
                f"-c idle_in_transaction_session_timeout={idle_transaction_timeout_ms}",
            )
        )
        url = url.update_query_dict({"options": options})
        arguments.update(pool_size=pool_size, max_overflow=max_overflow)
    return create_engine(url, **arguments)


def database_url_with_password(database_url: str, password_file: Path | None) -> URL:
    if password_file is None:
        return make_url(database_url)
    password = password_file.read_text(encoding="utf-8").rstrip("\r\n")
    if not password:
        raise ValueError("database password file is empty")
    return make_url(database_url).set(password=password)


def session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False)


def readiness_probe(engine: Engine) -> None:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
