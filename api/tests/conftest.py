import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture
def alembic_config(tmp_path: Path) -> Config:
    root = Path(__file__).resolve().parents[2]
    config = Config(str(root / "api" / "alembic.ini"))
    config.set_main_option(
        "sqlalchemy.url",
        os.environ.get(
            "VONK_TEST_DATABASE_URL", f"sqlite:///{tmp_path / 'catalog.db'}"
        ),
    )
    return config


@pytest.fixture
def engine() -> Iterator[Engine]:
    from vonk_catalog.models import Base

    database_url = os.environ.get("VONK_TEST_DATABASE_URL")
    if database_url:
        value = create_engine(database_url)
        with value.begin() as connection:
            connection.execute(text("DROP SCHEMA public CASCADE"))
            connection.execute(text("CREATE SCHEMA public"))
        root = Path(__file__).resolve().parents[2]
        config = Config(str(root / "api" / "alembic.ini"))
        config.set_main_option("sqlalchemy.url", database_url)
        command.upgrade(config, "head")
    else:
        value = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(value)
    yield value
    if database_url:
        command.downgrade(config, "base")
    else:
        Base.metadata.drop_all(value)
    value.dispose()


@pytest.fixture
def session(engine: Engine) -> Iterator[Session]:
    with Session(engine) as value:
        yield value


@pytest.fixture
def client(engine: Engine):
    from fastapi.testclient import TestClient
    from vonk_catalog.api import create_app

    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    with TestClient(create_app(database_sessions=sessions)) as value:
        yield value
