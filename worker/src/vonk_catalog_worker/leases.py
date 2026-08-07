from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import Engine, text


@dataclass(frozen=True, slots=True)
class LeasedJob:
    id: str
    kind: str
    payload: dict[str, object]
    attempt: int


class JobLeases:
    def __init__(
        self,
        engine: Engine,
        *,
        lease_duration: timedelta = timedelta(minutes=5),
        max_attempts: int = 5,
    ) -> None:
        self.engine = engine
        self.lease_duration = lease_duration
        self.max_attempts = max_attempts

    def claim(self) -> LeasedJob | None:
        now = datetime.now(UTC)
        until = now + self.lease_duration
        with self.engine.begin() as connection:
            row = (
                connection.execute(
                    text(
                        """
                    SELECT id, kind, payload, attempt
                    FROM catalog_jobs
                    WHERE attempt < :max_attempts
                      AND (state = 'pending' OR (state = 'running' AND lease_until < :now))
                    ORDER BY created_at, id
                    FOR UPDATE SKIP LOCKED
                    LIMIT 1
                    """
                    ),
                    {"max_attempts": self.max_attempts, "now": now},
                )
                .mappings()
                .first()
            )
            if row is None:
                return None
            connection.execute(
                text(
                    """
                    UPDATE catalog_jobs
                    SET state = 'running', lease_until = :until,
                        attempt = attempt + 1, updated_at = :now,
                        problem_code = NULL
                    WHERE id = :id
                    """
                ),
                {"id": row["id"], "until": until, "now": now},
            )
            payload = row["payload"]
            if isinstance(payload, str):
                payload = json.loads(payload)
            return LeasedJob(
                str(row["id"]), str(row["kind"]), dict(payload), int(row["attempt"]) + 1
            )

    def renew(self, job_id: str) -> bool:
        now = datetime.now(UTC)
        with self.engine.begin() as connection:
            result = connection.execute(
                text(
                    """
                    UPDATE catalog_jobs SET lease_until = :until, updated_at = :now
                    WHERE id = :id AND state = 'running' AND lease_until >= :now
                    """
                ),
                {"id": job_id, "now": now, "until": now + self.lease_duration},
            )
            return result.rowcount == 1

    def complete(self, job_id: str) -> None:
        with self.engine.begin() as connection:
            connection.execute(
                text(
                    """
                    UPDATE catalog_jobs SET state = 'completed', lease_until = NULL,
                        problem_code = NULL, updated_at = :now
                    WHERE id = :id AND state = 'running'
                    """
                ),
                {"id": job_id, "now": datetime.now(UTC)},
            )

    def fail(self, job: LeasedJob, code: str, *, retryable: bool) -> None:
        state = "pending" if retryable and job.attempt < self.max_attempts else "failed"
        with self.engine.begin() as connection:
            connection.execute(
                text(
                    """
                    UPDATE catalog_jobs SET state = :state, lease_until = NULL,
                        problem_code = :code, updated_at = :now
                    WHERE id = :id AND state = 'running'
                    """
                ),
                {
                    "id": job.id,
                    "state": state,
                    "code": code[:128],
                    "now": datetime.now(UTC),
                },
            )
