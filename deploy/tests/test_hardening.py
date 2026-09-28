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
        last = subprocess.run(command, text=True, capture_output=True, check=False)
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


def test_local_and_pages_assets_are_immutable_but_html_is_not_cached() -> None:
    caddy = (ROOT / "deploy" / "Caddyfile").read_text()
    assert "path /assets/*" in caddy
    assert "path /v1/* /health/ready" in caddy
    assert "max-age=31536000, immutable" in caddy
    assert 'Cache-Control "no-store"' in caddy
    assert "Content-Security-Policy" in caddy
    pages_headers = (ROOT / "web" / "public" / "_headers").read_text()
    assert "Content-Security-Policy:" in pages_headers
    assert "max-age=31536000, immutable" in pages_headers
    assert (
        ROOT / "web" / "public" / "_redirects"
    ).read_text().strip() == "/* /index.html 200"


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
    pages = (ROOT / ".github" / "workflows" / "pages.yml").read_text()
    assert "gitleaks/gitleaks-action@" in ci
    assert "aquasecurity/trivy-action@" in ci
    containers = yaml.safe_load(ci)["jobs"]["containers"]["steps"]
    built = {
        step["run"].split(" -t ")[1].split()[0]
        for step in containers
        if step.get("run", "").startswith("docker build ")
    }
    scans = [
        step["with"]
        for step in containers
        if step.get("uses", "").startswith("aquasecurity/trivy-action@")
    ]
    images = {
        f"vonk-catalog-{name}:test" for name in ("api", "worker", "web", "backup")
    }
    # Unmodified upstream release binaries: reported, not gated.
    upstream = {
        "vonk-catalog-web:test": "/usr/bin/caddy",
        "vonk-catalog-backup:test": "/usr/local/bin/rclone",
    }
    reports = {scan["image-ref"]: scan for scan in scans if scan["exit-code"] == "0"}
    gates = {scan["image-ref"]: scan for scan in scans if scan["exit-code"] == "1"}
    assert len(scans) == len(reports) + len(gates) == 2 * len(images)
    assert built == set(reports) == set(gates) == images
    for scan in scans:
        assert scan["scan-type"] == "image"
        assert scan["severity"] == "HIGH,CRITICAL"
        assert scan["ignore-unfixed"] is True
    for report in reports.values():
        assert report["format"] == "sarif"
        assert report["limit-severities-for-sarif"] is True
        assert "vuln-type" not in report and "skip-files" not in report
    for image, gate in gates.items():
        assert gate["vuln-type"] == "os,library"
        assert gate.get("skip-files") == upstream.get(image)
    assert "cloudflare/wrangler-action@" in pages
    assert "CLOUDFLARE_API_TOKEN" in pages
    assert "CLOUDFLARE_ACCOUNT_ID" in pages
    assert "pages deploy web/dist" in pages
    assert "CLOUDFLARE_PAGES_PROJECT is missing" in pages
    assert "gitHubToken:" not in pages
    assert "RAILWAY_" not in pages
    assert not (ROOT / ".github" / "workflows" / "deploy.yml").exists()
    assert not (ROOT / "scripts" / "railway-deploy-images").exists()
    workflow = yaml.safe_load(pages)
    assert workflow["concurrency"]["group"] == "vonk-forge-pages-production"
    assert workflow["concurrency"]["cancel-in-progress"] is False
    triggers = workflow.get("on", workflow.get(True, {}))
    assert triggers["push"]["branches"] == ["main"]


@pytest.mark.skipif(
    os.getenv("VONK_TEST_CONTAINER_IMAGES") != "1",
    reason="set after building test images",
)
def test_built_images_are_non_root_secret_free_read_only_and_healthy() -> None:
    # CI builds the ``test`` tag; a shared local daemon can use a unique one.
    tag = os.getenv("VONK_TEST_IMAGE_TAG", "test")
    images = {
        name: f"vonk-catalog-{name}:{tag}"
        for name in ("api", "worker", "web", "backup")
    }
    for image in images.values():
        details = json.loads(
            subprocess.check_output(["docker", "image", "inspect", image])
        )[0]
        assert details["Config"]["User"] == "10001:10001"
        serialized = json.dumps(details["Config"]).lower()
        assert "development-only-session-secret" not in serialized
        assert "postgres-password" not in serialized

    # Runtime images carry no package installer, and the backup image carries
    # only the PostgreSQL client tools it runs, not the server's gosu helper.
    for name in ("api", "worker", "backup"):
        probe = subprocess.run(
            ["docker", "run", "--rm", "--entrypoint", "python", images[name]]
            + ["-c", "import importlib.util; print(importlib.util.find_spec('pip'))"],
            text=True,
            capture_output=True,
            check=True,
        )
        assert probe.stdout.strip() == "None"
    backup_probe = (
        "test ! -e /usr/local/bin/gosu && test ! -e /usr/bin/rclone"
        " && pg_dump --version"
        " && age --version && rclone version"
    )
    backup_tools = subprocess.run(
        ["docker", "run", "--rm", images["backup"], "sh", "-c", backup_probe],
        text=True,
        capture_output=True,
        check=True,
    ).stdout
    assert "pg_dump (PostgreSQL) 18." in backup_tools
    assert "rclone v" in backup_tools

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
            images["api"],
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
            images["web"],
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
