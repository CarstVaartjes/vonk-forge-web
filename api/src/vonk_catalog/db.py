from pathlib import Path

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import Session, sessionmaker


def build_engine(database_url: str | URL) -> Engine:
    return create_engine(database_url, pool_pre_ping=True)


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
