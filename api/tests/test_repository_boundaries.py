import json
import subprocess
from pathlib import Path

import pytest

from vonk_catalog.contracts import RecipeContractError, validate_recipe


ROOT = Path(__file__).resolve().parents[2]


def tracked_files() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files"], cwd=ROOT, check=True, capture_output=True, text=True
    )
    return result.stdout.splitlines()


def test_contract_verifier_is_present_and_executable() -> None:
    verifier = ROOT / "scripts" / "verify-contracts"
    assert verifier.is_file()
    assert verifier.stat().st_mode & 0o111


def test_repository_does_not_track_model_or_container_payloads() -> None:
    forbidden = (".safetensors", ".gguf", ".tar", ".tar.gz")
    assert [path for path in tracked_files() if path.lower().endswith(forbidden)] == []


def test_api_does_not_import_container_runtime_clients() -> None:
    api_sources = (ROOT / "api" / "src").rglob("*.py")
    offenders = [
        str(path.relative_to(ROOT))
        for path in api_sources
        if "import docker" in path.read_text(encoding="utf-8")
    ]
    assert offenders == []


def test_worker_does_not_import_web_or_api_internals() -> None:
    worker_sources = (ROOT / "worker" / "src").rglob("*.py")
    offenders = []
    for path in worker_sources:
        content = path.read_text(encoding="utf-8")
        if "vonk_catalog." in content or "web." in content:
            offenders.append(str(path.relative_to(ROOT)))
    assert offenders == []


def test_schema_cannot_enable_commands_or_privilege() -> None:
    recipe = json.loads(
        (ROOT / "schemas" / "fixtures" / "recipe-v1-minimal.json").read_text()
    )
    recipe["runtime"]["command"] = ["sh", "-c", "id"]
    recipe["security"]["privileged"] = True

    with pytest.raises(RecipeContractError):
        validate_recipe(recipe)
