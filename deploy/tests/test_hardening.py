import json
import os
import subprocess
import time
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]


def _wait_for_container_health(command: list[str]) -> str:
    last = None
    for _ in range(50):
        last = subprocess.run(command, text=True, capture_output=True)
        if last.returncode == 0:
            return last.stdout
        time.sleep(0.2)
    assert last is not None
    raise subprocess.CalledProcessError(
        last.returncode, command, output=last.stdout, stderr=last.stderr
    )


def test_canonical_images_are_digest_pinned_and_run_as_non_root() -> None:
    for name in ("api", "worker", "web"):
        source = (ROOT / f"Dockerfile.{name}").read_text()
        assert "@sha256:" in source
        assert "USER 10001:10001" in source
        assert "ARG VONK_" not in source
        assert "COPY . ." not in source


def test_service_separation_migration_and_egress_policy_are_declared() -> None:
    compose = yaml.safe_load((ROOT / "deploy" / "compose.yaml").read_text())
    services = compose["services"]
    assert set(services) >= {"postgres", "migrate", "api", "worker", "web"}
    assert services["migrate"]["command"] == [
        "alembic",
        "-c",
        "api/alembic.ini",
        "upgrade",
        "head",
    ]
    assert services["api"]["read_only"] is True
    assert services["worker"]["read_only"] is True
    assert "ports" not in services["worker"]
    assert set(services["worker"]["networks"]) == {"database", "public_https"}
    assert set(services["web"]["networks"]) == {"application", "public_ingress"}
    assert compose["networks"]["database"]["internal"] is True

    railway = {
        path.stem: path.read_text()
        for path in (ROOT / "deploy" / "railway").glob("*.toml")
    }
    assert {"api", "worker", "web", "migration", "backup", "restore"} <= set(railway)
    assert 'restartPolicyType = "NEVER"' in railway["migration"]
    assert 'cronSchedule = "0 2 * * *"' in railway["backup"]
    assert 'cronSchedule = "0 4 1 * *"' in railway["restore"]


def test_web_assets_are_immutable_but_html_and_health_are_not_cached() -> None:
    caddy = (ROOT / "deploy" / "Caddyfile").read_text()
    assert "path /assets/*" in caddy
    assert "path /v1/* /health/ready" in caddy
    assert "max-age=31536000, immutable" in caddy
    assert 'Cache-Control "no-store"' in caddy
    assert "Content-Security-Policy" in caddy


def test_backup_and_restore_are_encrypted_independent_and_verify_hashes() -> None:
    backup = (ROOT / "scripts" / "backup-database").read_text()
    restore = (ROOT / "scripts" / "restore-database").read_text()
    verifier = (ROOT / "scripts" / "verify-restored-database").read_text()
    assert "pg_dump" in backup and "age" in backup and "rclone rcat" in backup
    assert "BACKUP_REMOTE" in backup and "DATABASE_URL" in backup
    assert "age --decrypt" in restore and "pg_restore" in restore
    assert "RESTORE_DATABASE_URL" in restore and "SOURCE_DATABASE_URL" not in restore
    assert "recipe_revisions" in verifier and "content_sha256" in verifier


def test_ci_scans_secrets_vulnerabilities_sboms_and_signs_images() -> None:
    ci = (ROOT / ".github" / "workflows" / "ci.yml").read_text()
    deploy = (ROOT / ".github" / "workflows" / "deploy.yml").read_text()
    assert "gitleaks/gitleaks-action@" in ci
    assert "aquasecurity/trivy-action@" in ci
    assert "cosign sign --yes" in deploy
    assert "anchore/sbom-action@" in deploy
    assert "actions/attest-build-provenance@" in deploy
    assert "environment: production" in deploy
    assert "RAILWAY_PRODUCTION_TOKEN" in deploy
    workflow = yaml.safe_load(deploy)
    assert workflow["concurrency"]["group"] == "vonk-forge-railway-deploy"
    assert workflow["concurrency"]["cancel-in-progress"] is False
    triggers = workflow.get("on", workflow.get(True, {}))
    assert triggers["push"]["branches"] == ["main"]


def test_railway_deploys_the_signed_registry_digest_without_source_rebuild() -> None:
    deploy = yaml.safe_load((ROOT / ".github" / "workflows" / "deploy.yml").read_text())
    serialized = json.dumps(deploy)

    assert "deployment-${{ matrix.name }}.txt" in serialized
    assert "cosign verify" in serialized
    assert "up --ci" not in serialized
    assert "RAILWAY_PRODUCTION_PROJECT_ID" in serialized
    assert "RAILWAY_STAGING_PROJECT_ID" not in serialized
    assert "github.ref == 'refs/heads/main'" in serialized
    deploy_helper = (ROOT / "scripts" / "railway-deploy-images").read_text()
    assert "service source connect" in deploy_helper
    assert "--image" in deploy_helper
    assert "deployment list --json --limit 1" in deploy_helper
    assert '"$deployment_id" != "$before"' in deploy_helper
    assert '"$status" != SUCCESS' in deploy_helper
    assert ".meta | .. | strings" in deploy_helper
    assert "requested_digest" in deploy_helper


def test_railway_deploy_waits_for_the_matching_digest_metadata(tmp_path) -> None:
    docker = tmp_path / "docker"
    marker = tmp_path / "connected"
    docker.write_text(
        """#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == *"service source connect"* ]]; then
  : > "$MOCK_MARKER"
  printf '{}\\n'
elif [[ ! -e "$MOCK_MARKER" ]]; then
  printf '[{"id":"old","status":"SUCCESS","meta":{"image":"old@sha256:old"}}]\\n'
else
  printf '[{"id":"new","status":"SUCCESS","meta":{"image":"%s"}}]\\n' "$MOCK_IMAGE"
fi
"""
    )
    docker.chmod(0o755)
    requested = "ghcr.io/vonk/app@sha256:" + "a" * 64
    environment = {
        **os.environ,
        "PATH": f"{tmp_path}:{os.environ['PATH']}",
        "RAILWAY_TOKEN": "test-token",
        "CLI_IMAGE": "railway-cli@sha256:test",
        "MOCK_MARKER": str(marker),
        "MOCK_IMAGE": requested,
    }
    result = subprocess.run(
        [
            ROOT / "scripts" / "railway-deploy-images",
            "production",
            "project-id",
            f"api={requested}",
        ],
        env=environment,
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr

    marker.unlink()
    environment["MOCK_IMAGE"] = "ghcr.io/vonk/app@sha256:" + "b" * 64
    result = subprocess.run(
        [
            ROOT / "scripts" / "railway-deploy-images",
            "production",
            "project-id",
            f"api={requested}",
        ],
        env=environment,
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert "does not identify requested digest" in result.stderr


@pytest.mark.skipif(
    os.getenv("VONK_TEST_CONTAINER_IMAGES") != "1",
    reason="set after building test images",
)
def test_built_images_are_non_root_secret_free_read_only_and_healthy() -> None:
    images = {
        "api": "vonk-catalog-api:test",
        "worker": "vonk-catalog-worker:test",
        "web": "vonk-catalog-web:test",
        "backup": "vonk-catalog-backup:test",
    }
    for image in images.values():
        details = json.loads(
            subprocess.check_output(["docker", "image", "inspect", image])
        )[0]
        assert details["Config"]["User"] == "10001:10001"
        serialized = json.dumps(details["Config"]).lower()
        assert "development-only-session-secret" not in serialized
        assert "postgres-password" not in serialized

    api_id = subprocess.check_output(
        [
            "docker",
            "run",
            "-d",
            "--read-only",
            "--cap-drop",
            "ALL",
            "--security-opt",
            "no-new-privileges",
            "--tmpfs",
            "/tmp:rw,noexec,nosuid,size=16m",
            "vonk-catalog-api:test",
        ],
        text=True,
    ).strip()
    web_id = subprocess.check_output(
        [
            "docker",
            "run",
            "-d",
            "--read-only",
            "--cap-drop",
            "ALL",
            "--security-opt",
            "no-new-privileges",
            "--tmpfs",
            "/config:rw,noexec,nosuid,size=8m",
            "--tmpfs",
            "/data:rw,noexec,nosuid,size=8m",
            "--tmpfs",
            "/tmp:rw,noexec,nosuid,size=8m",
            "vonk-catalog-web:test",
        ],
        text=True,
    ).strip()
    try:
        api_health = _wait_for_container_health(
            [
                "docker",
                "exec",
                api_id,
                "python",
                "-c",
                "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health/live').status)",
            ],
        )
        web_health = _wait_for_container_health(
            [
                "docker",
                "exec",
                web_id,
                "wget",
                "-qO-",
                "http://127.0.0.1:8080/health/live",
            ],
        )
        assert api_health.strip() == "200"
        assert "live" in web_health
    finally:
        subprocess.run(
            ["docker", "rm", "-f", api_id, web_id], check=False, capture_output=True
        )
