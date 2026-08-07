from datetime import UTC, datetime

from vonk_catalog_worker.main import WorkerHeartbeat, build_worker_engine


def test_worker_heartbeat_has_stable_identity() -> None:
    heartbeat = WorkerHeartbeat(
        process_id="worker-1",
        observed_at=datetime(2026, 8, 7, 12, 0, tzinfo=UTC),
    )

    assert heartbeat.as_record() == {
        "service": "vonk-catalog-worker",
        "process_id": "worker-1",
        "observed_at": "2026-08-07T12:00:00+00:00",
    }


def test_worker_database_connections_are_bounded_and_timed_out() -> None:
    engine = build_worker_engine(
        "postgresql+psycopg://vonk:secret@database.invalid/vonk_catalog",
        pool_size=3,
        max_overflow=1,
        statement_timeout_ms=20_000,
        lock_timeout_ms=4_000,
        idle_transaction_timeout_ms=25_000,
    )

    assert engine.pool.size() == 3
    assert engine.pool._max_overflow == 1
    options = engine.dialect.create_connect_args(engine.url)[1]["options"]
    assert "statement_timeout=20000" in options
    assert "lock_timeout=4000" in options
    assert "idle_in_transaction_session_timeout=25000" in options
