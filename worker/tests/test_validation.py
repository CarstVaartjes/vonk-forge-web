from datetime import UTC, datetime
from pathlib import Path

from vonk_catalog_worker.validation import (
    validate_resource_envelope,
    validate_test_evidence,
)

SCHEMA = Path(__file__).resolve().parents[2] / "schemas/test-report/v1.schema.json"


def test_declared_resource_envelope_covers_observed_image_and_artifacts() -> None:
    document = {
        "artifacts": [
            {
                "id": "one",
                "kind": "http.file",
                "download_bytes": 100,
                "installed_bytes": 100,
            },
            {
                "id": "two",
                "kind": "huggingface.snapshot",
                "download_bytes": 200,
                "installed_bytes": 200,
            },
        ],
        "deployment_profiles": [
            {
                "roles": [
                    {
                        "artifacts": ["one", "two"],
                        "resources": {
                            "disk": {"artifact_bytes": 300, "staging_bytes": 200}
                        },
                    }
                ]
            }
        ],
    }
    assert all(
        check["passed"]
        for check in validate_resource_envelope(document, artifact_sizes=[100, 200])
    )

    document["deployment_profiles"][0]["roles"][0]["resources"]["disk"][
        "artifact_bytes"
    ] = 299
    checks = validate_resource_envelope(document, artifact_sizes=[100, 200])
    assert not next(
        check["passed"]
        for check in checks
        if check["code"] == "resources.profile_artifact_bytes"
    )

    size_checks = validate_resource_envelope(document, artifact_sizes=[99, 200])
    assert not next(
        check["passed"]
        for check in size_checks
        if check["code"] == "resources.artifact_sizes"
    )


def _report(recipe_hash: str, image_digest: str, nodes: int = 1) -> dict[str, object]:
    return {
        "schema_version": 1,
        "recipe_sha256": recipe_hash,
        "source_bundle_sha256": "a" * 64,
        "build_input_sha256": "b" * 64,
        "image_digest": image_digest,
        "deployment_profile": "solo",
        "node_count": nodes,
        "runtime": {
            "agent_version": "1.0.0",
            "container_runtime": "podman",
            "architecture": "linux/arm64",
        },
        "checks": [
            {"name": "container.started", "passed": True},
            {"name": "endpoint.healthy", "passed": True},
            {"name": "inference.completed", "passed": True},
        ],
        "started_at": "2026-08-07T10:00:00Z",
        "finished_at": "2026-08-07T10:05:00Z",
    }


def test_evidence_binds_recipe_image_topology_runtime_and_required_checks() -> None:
    recipe_hash = "1" * 64
    image_digest = "sha256:" + "2" * 64
    result = validate_test_evidence(
        _report(recipe_hash, image_digest),
        recipe_sha256=recipe_hash,
        source_bundle_sha256="a" * 64,
        deployment_profiles={"solo": 1},
        schema_path=SCHEMA,
        now=datetime(2026, 8, 7, 11, tzinfo=UTC),
    )
    assert result.accepted
    assert result.provenance == "publisher-submitted"


def test_evidence_never_converts_mismatch_or_failed_check_into_success() -> None:
    report = _report("1" * 64, "sha256:" + "2" * 64, nodes=2)
    report["checks"][1]["passed"] = False
    result = validate_test_evidence(
        report,
        recipe_sha256="3" * 64,
        source_bundle_sha256="c" * 64,
        deployment_profiles={"solo": 1},
        schema_path=SCHEMA,
        now=datetime(2026, 8, 7, 11, tzinfo=UTC),
    )
    assert not result.accepted
    codes = {check["code"] for check in result.checks if not check["passed"]}
    assert {
        "evidence.recipe_mismatch",
        "evidence.source_bundle_mismatch",
        "evidence.node_count_unverified",
        "evidence.check_failed",
    } <= codes
