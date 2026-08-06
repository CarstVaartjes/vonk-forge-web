from datetime import UTC, datetime

from vonk_catalog_worker.main import WorkerHeartbeat


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
