from pathlib import Path

import yaml


def test_compose_has_separate_public_and_private_services() -> None:
    root = Path(__file__).resolve().parents[2]
    rendered = yaml.safe_load((root / "deploy" / "compose.yaml").read_text())

    services = rendered["services"]
    assert set(services) == {"postgres", "migrate", "api", "web", "worker"}
    assert "ports" not in services["postgres"]
    assert "ports" not in services["worker"]
    assert services["postgres"]["healthcheck"]
    assert services["migrate"]["depends_on"]["postgres"]["condition"] == (
        "service_healthy"
    )
    assert services["api"]["depends_on"]["migrate"]["condition"] == (
        "service_completed_successfully"
    )
    assert services["api"]["read_only"] is True
    assert services["worker"]["read_only"] is True
