from __future__ import annotations

import json
import os
import signal
import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL, make_url

from .leases import JobLeases
from .registry import RegistryClient, RegistryProblem, RegistryTemporaryProblem
from .validation import ValidationJobProblem, process_validation_job


@dataclass(frozen=True, slots=True)
class WorkerHeartbeat:
    process_id: str
    observed_at: datetime

    def as_record(self) -> dict[str, str]:
        return {
            "service": "vonk-catalog-worker",
            "process_id": self.process_id,
            "observed_at": self.observed_at.isoformat(),
        }


def _integer_environment(name: str, default: int, minimum: int, maximum: int) -> int:
    value = int(os.environ.get(name, str(default)))
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}")
    return value


def build_worker_engine(
    database_url: str | URL,
    *,
    pool_size: int = 3,
    max_overflow: int = 2,
    statement_timeout_ms: int = 30_000,
    lock_timeout_ms: int = 5_000,
    idle_transaction_timeout_ms: int = 30_000,
):
    url = make_url(database_url) if isinstance(database_url, str) else database_url
    options = " ".join(
        (
            f"-c statement_timeout={statement_timeout_ms}",
            f"-c lock_timeout={lock_timeout_ms}",
            f"-c idle_in_transaction_session_timeout={idle_transaction_timeout_ms}",
        )
    )
    url = url.update_query_dict({"options": options})
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=pool_size,
        max_overflow=max_overflow,
    )


def _event(**fields: object) -> None:
    print(json.dumps(fields, separators=(",", ":"), sort_keys=True), flush=True)


def main() -> None:
    database_url = os.environ["VONK_DATABASE_URL"]
    password_file = os.environ.get("VONK_DATABASE_PASSWORD_FILE")
    if password_file is not None:
        password = Path(password_file).read_text(encoding="utf-8").rstrip("\r\n")
        if not password:
            raise ValueError("database password file is empty")
        database_url = make_url(database_url).set(password=password)
    interval = max(1, int(os.environ.get("VONK_WORKER_HEARTBEAT_SECONDS", "15")))
    process_id = str(uuid.uuid4())
    engine = build_worker_engine(
        database_url,
        pool_size=_integer_environment("VONK_DATABASE_POOL_SIZE", 3, 1, 20),
        max_overflow=_integer_environment("VONK_DATABASE_MAX_OVERFLOW", 2, 0, 20),
        statement_timeout_ms=_integer_environment(
            "VONK_DATABASE_STATEMENT_TIMEOUT_MS", 30_000, 1_000, 300_000
        ),
        lock_timeout_ms=_integer_environment(
            "VONK_DATABASE_LOCK_TIMEOUT_MS", 5_000, 500, 60_000
        ),
        idle_transaction_timeout_ms=_integer_environment(
            "VONK_DATABASE_IDLE_TRANSACTION_TIMEOUT_MS",
            30_000,
            1_000,
            300_000,
        ),
    )
    leases = JobLeases(engine)
    registry = RegistryClient()
    schema_path = Path(
        os.environ.get(
            "VONK_TEST_REPORT_SCHEMA",
            "/app/schemas/test-report/v1.schema.json",
        )
    )
    stopping = False

    def stop(*_: object) -> None:
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    while not stopping:
        job = leases.claim()
        if job is not None:
            try:
                process_validation_job(
                    engine, job, registry=registry, schema_path=schema_path
                )
            except RegistryTemporaryProblem as error:
                leases.fail(job, error.code, retryable=True)
                _event(
                    event="validation.failed",
                    job_id=job.id,
                    code=error.code,
                    retryable=True,
                )
            except (RegistryProblem, ValidationJobProblem) as error:
                leases.fail(job, error.code, retryable=False)
                _event(
                    event="validation.failed",
                    job_id=job.id,
                    code=error.code,
                    retryable=False,
                )
            except Exception:
                leases.fail(job, "validation.internal_error", retryable=True)
                _event(
                    event="validation.failed",
                    job_id=job.id,
                    code="validation.internal_error",
                    retryable=True,
                )
                raise
            else:
                leases.complete(job.id)
                _event(event="validation.completed", job_id=job.id)
            continue
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        heartbeat = WorkerHeartbeat(process_id, datetime.now(UTC))
        print(json.dumps(heartbeat.as_record(), separators=(",", ":")), flush=True)
        for _ in range(interval):
            if stopping:
                break
            time.sleep(1)


if __name__ == "__main__":
    main()
