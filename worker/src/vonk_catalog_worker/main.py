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
from sqlalchemy.engine import make_url


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
    engine = create_engine(database_url, pool_pre_ping=True)
    stopping = False

    def stop(*_: object) -> None:
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    while not stopping:
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
