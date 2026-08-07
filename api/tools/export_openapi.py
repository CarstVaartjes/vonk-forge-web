from __future__ import annotations

import json
from pathlib import Path

from vonk_catalog.api import create_app


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    destination = root / "openapi" / "openapi.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(create_app().openapi(), ensure_ascii=False, indent=2, sort_keys=True)
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
