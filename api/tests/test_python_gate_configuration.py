"""The Python gates must stay configured, deterministic and wired to CI.

Every finding here changes which diagnostics exist or which files are checked,
so a dropped setting makes the reviewed baseline disagree with the checker
without any source change. The recipes repository shipped its pyright baseline
without the matching `[tool.pyright]` section for exactly this reason.
"""

from __future__ import annotations

import re
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PYPROJECT = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))
WORKFLOWS = tuple(sorted((ROOT / ".github" / "workflows").glob("*.yml")))


def test_pyright_configuration_is_pinned() -> None:
    pyright = PYPROJECT.get("tool", {}).get("pyright")
    assert isinstance(pyright, dict), "pyproject.toml has no [tool.pyright] section"
    # Both settings change the diagnostic set, so the baseline is only
    # meaningful while they are pinned.
    assert pyright.get("pythonVersion") == "3.14"
    assert pyright.get("typeCheckingMode") == "basic"
    assert pyright.get("venv") == ".venv"


def test_ruff_configuration_is_pinned() -> None:
    ruff = PYPROJECT.get("tool", {}).get("ruff")
    assert isinstance(ruff, dict), "pyproject.toml has no [tool.ruff] section"
    assert ruff.get("required-version") == "==0.16.1"
    assert ruff.get("target-version") == "py314"


def test_formatter_skips_only_historical_documents() -> None:
    formatter = PYPROJECT["tool"]["ruff"].get("format", {})
    # Dated plan documents are history and are still linted, but nothing else
    # may be carved out of the format check.
    assert formatter.get("exclude") == ["docs/**/*.md"]


def test_every_python_gate_runs_in_ci() -> None:
    checks = {
        "lint": re.compile(r"ruff==0\.16\.1\s+ruff\s+check\s+\."),
        "format": re.compile(r"scripts/check-python-format"),
        "types": re.compile(r"scripts/check-python-types"),
    }
    for name, pattern in checks.items():
        assert any(
            pattern.search(path.read_text(encoding="utf-8")) for path in WORKFLOWS
        ), f"no workflow runs the {name} gate"
