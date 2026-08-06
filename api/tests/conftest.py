from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic.config import Config
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture
def alembic_config(tmp_path: Path) -> Config:
    root = Path(__file__).resolve().parents[2]
    config = Config(str(root / "api" / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", f"sqlite:///{tmp_path / 'catalog.db'}")
    return config


@pytest.fixture
def engine() -> Iterator[Engine]:
    from vonk_catalog.models import Base

    value = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(value)
    yield value
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
