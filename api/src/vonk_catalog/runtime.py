from vonk_catalog.api import create_app as create_base_app
from vonk_catalog.db import (
    build_engine,
    database_url_with_password,
    readiness_probe,
    session_factory,
)
from vonk_catalog.settings import Settings


def create_app():
    settings = Settings()
    engine = build_engine(
        database_url_with_password(
            settings.database_url, settings.database_password_file
        ),
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
        statement_timeout_ms=settings.database_statement_timeout_ms,
        lock_timeout_ms=settings.database_lock_timeout_ms,
        idle_transaction_timeout_ms=settings.database_idle_transaction_timeout_ms,
    )
    return create_base_app(
        readiness_probe=lambda: readiness_probe(engine),
        database_sessions=session_factory(engine),
        settings=settings,
    )
