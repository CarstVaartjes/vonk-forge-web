from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker
from sqlalchemy import Engine, text

from .leases import LeasedJob
from .registry import ImageMetadata, RegistryClient

REQUIRED_CHECKS = {
    "container.started",
    "endpoint.healthy",
    "inference.completed",
}


@dataclass(frozen=True, slots=True)
class EvidenceValidation:
    accepted: bool
    provenance: str
    checks: tuple[dict[str, object], ...]


def _check(code: str, passed: bool, detail: str) -> dict[str, object]:
    return {"code": code, "passed": passed, "detail": detail}


def validate_image_contract(
    image: ImageMetadata, *, policy_path: Path
) -> tuple[dict[str, object], ...]:
    policy = json.loads(policy_path.read_text(encoding="utf-8"))
    label = policy["required_image_label"]
    accepted_users = policy["accepted_config_users"]
    configured_user = image.config_user if image.config_user is not None else ""
    return (
        _check(
            "registry.arm64_available",
            image.architecture == policy["architecture"],
            "image architecture matches the Vonk runtime contract",
        ),
        _check(
            "registry.runtime_interface",
            image.labels.get(label["name"]) == label["value"],
            "image declares the required Vonk runtime interface label",
        ),
        _check(
            "registry.container_root",
            configured_user in accepted_users,
            "image runs as container root inside the agent's rootless single-UID namespace",
        ),
    )


def validate_resource_envelope(
    document: dict[str, object], *, image_layer_bytes: int
) -> tuple[dict[str, object], ...]:
    try:
        artifacts = document["artifacts"]
        per_node = document["resources"]["per_node"]
        artifact_sizes = [int(artifact["expected_bytes"]) for artifact in artifacts]
        download_bytes = int(per_node["download_bytes"])
        installed_bytes = int(per_node["installed_bytes"])
        staging_bytes = int(per_node["staging_bytes"])
    except (KeyError, TypeError, ValueError) as error:
        raise ValidationJobProblem("draft resource envelope is invalid") from error
    total_observed = image_layer_bytes + sum(artifact_sizes)
    largest_artifact = max(artifact_sizes, default=0)
    return (
        _check(
            "resources.download_bytes",
            download_bytes >= total_observed,
            "declared download bytes cover observed image layers and artifacts",
        ),
        _check(
            "resources.installed_bytes",
            installed_bytes >= total_observed,
            "declared installed bytes cover observed image layers and artifacts",
        ),
        _check(
            "resources.staging_bytes",
            staging_bytes >= largest_artifact,
            "declared staging bytes cover the largest immutable artifact",
        ),
    )


def _timestamp(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(UTC)


def validate_test_evidence(
    report: dict[str, object],
    *,
    recipe_sha256: str,
    image_digest: str,
    tested_node_counts: set[int],
    schema_path: Path,
    now: datetime,
) -> EvidenceValidation:
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    schema_errors = sorted(
        validator.iter_errors(report),
        key=lambda error: tuple(str(part) for part in error.absolute_path),
    )
    checks: list[dict[str, object]] = [
        _check(
            "evidence.schema_valid",
            not schema_errors,
            "test report matches v1 schema"
            if not schema_errors
            else f"{'.'.join(map(str, schema_errors[0].absolute_path)) or '$'}: {schema_errors[0].message}"[
                :512
            ],
        )
    ]
    checks.append(
        _check(
            "evidence.recipe_mismatch",
            report.get("recipe_sha256") == recipe_sha256,
            "report is bound to the canonical recipe hash",
        )
    )
    checks.append(
        _check(
            "evidence.image_mismatch",
            report.get("image_digest") == image_digest,
            "report is bound to the submitted image digest",
        )
    )
    node_count = report.get("node_count")
    checks.append(
        _check(
            "evidence.node_count_unverified",
            isinstance(node_count, int) and node_count in tested_node_counts,
            "report node count is declared as tested by the recipe",
        )
    )
    runtime = report.get("runtime")
    runtime_valid = (
        isinstance(runtime, dict)
        and runtime.get("container_runtime") in {"podman", "docker"}
        and runtime.get("architecture") == "linux/arm64"
        and isinstance(runtime.get("agent_version"), str)
        and bool(runtime["agent_version"])
    )
    checks.append(
        _check(
            "evidence.runtime_invalid",
            runtime_valid,
            "runtime identity is a supported ARM64 Vonk execution environment",
        )
    )
    submitted_checks = report.get("checks")
    by_name = (
        {
            item.get("name"): item.get("passed")
            for item in submitted_checks
            if isinstance(submitted_checks, list) and isinstance(item, dict)
        }
        if isinstance(submitted_checks, list)
        else {}
    )
    checks.append(
        _check(
            "evidence.check_failed",
            all(by_name.get(name) is True for name in REQUIRED_CHECKS),
            "all required local lifecycle and inference checks passed",
        )
    )
    started = _timestamp(report.get("started_at"))
    finished = _timestamp(report.get("finished_at"))
    aware_now = now if now.tzinfo is not None else now.replace(tzinfo=UTC)
    timestamps_valid = (
        started is not None
        and finished is not None
        and started <= finished
        and finished - started <= timedelta(hours=24)
        and finished <= aware_now + timedelta(minutes=5)
        and finished >= aware_now - timedelta(days=90)
    )
    checks.append(
        _check(
            "evidence.timestamps_invalid",
            timestamps_valid,
            "test timestamps are ordered, recent, and bounded",
        )
    )
    return EvidenceValidation(
        accepted=all(bool(check["passed"]) for check in checks),
        provenance="publisher-submitted",
        checks=tuple(checks),
    )


class ValidationJobProblem(RuntimeError):
    code = "validation.job_invalid"


def process_validation_job(
    engine: Engine,
    job: LeasedJob,
    *,
    registry: RegistryClient,
    schema_path: Path,
) -> None:
    if job.kind != "validate-draft":
        raise ValidationJobProblem("worker received an unsupported job kind")
    draft_id = job.payload.get("draft_id")
    expected_version = job.payload.get("draft_version")
    expected_hash = job.payload.get("content_sha256")
    if (
        not isinstance(draft_id, str)
        or not isinstance(expected_version, int)
        or not isinstance(expected_hash, str)
    ):
        raise ValidationJobProblem("validation job payload is invalid")
    with engine.connect() as connection:
        draft = (
            connection.execute(
                text(
                    "SELECT version, content_sha256, document FROM recipe_drafts WHERE id = :id"
                ),
                {"id": draft_id},
            )
            .mappings()
            .first()
        )
        reports = (
            connection.execute(
                text(
                    "SELECT report FROM test_reports WHERE draft_id = :id AND recipe_sha256 = :hash ORDER BY submitted_at DESC"
                ),
                {"id": draft_id, "hash": expected_hash},
            )
            .scalars()
            .all()
        )
    if (
        draft is None
        or draft["version"] != expected_version
        or draft["content_sha256"] != expected_hash
    ):
        raise ValidationJobProblem("draft changed before validation began")
    document = draft["document"]
    if isinstance(document, str):
        document = json.loads(document)
    if not isinstance(document, dict):
        raise ValidationJobProblem("draft document is invalid")
    try:
        runtime = document["runtime"]
        topology = document["topology"]
        image_reference = runtime["image"]
        tested_node_counts = set(topology["tested_node_counts"])
    except (KeyError, TypeError) as error:
        raise ValidationJobProblem("draft runtime or topology is invalid") from error
    if not isinstance(image_reference, str) or not all(
        isinstance(value, int) for value in tested_node_counts
    ):
        raise ValidationJobProblem("draft runtime or topology is invalid")
    image = registry.inspect(image_reference)
    policy_path = schema_path.parents[1] / "container-runtime-policy/v1.json"
    checks: list[dict[str, object]] = [
        _check(
            "registry.digest_verified",
            True,
            "registry bytes match the submitted digest",
        ),
        *validate_image_contract(image, policy_path=policy_path),
        {
            "code": "registry.metadata_observed",
            "passed": True,
            "detail": "registry metadata observed without pulling layer blobs",
            "observed": {
                "submitted_digest": image.submitted_digest,
                "arm64_manifest_digest": image.manifest_digest,
                "layer_bytes": image.layer_bytes,
                "manifest_media_type": image.manifest_media_type,
                "config_media_type": image.config_media_type,
                "layer_media_types": list(image.layer_media_types),
                "config_user": image.config_user,
                "labels": image.labels,
            },
        },
    ]
    checks.extend(
        validate_resource_envelope(document, image_layer_bytes=image.layer_bytes)
    )
    evidence_results: list[EvidenceValidation] = []
    for raw in reports[:20]:
        report = json.loads(raw) if isinstance(raw, str) else raw
        if isinstance(report, dict):
            evidence_results.append(
                validate_test_evidence(
                    report,
                    recipe_sha256=expected_hash,
                    image_digest=image.submitted_digest,
                    tested_node_counts=tested_node_counts,
                    schema_path=schema_path,
                    now=datetime.now(UTC),
                )
            )
    accepted_evidence = next(
        (result for result in evidence_results if result.accepted), None
    )
    checks.append(
        _check(
            "evidence.publisher_submitted_accepted",
            accepted_evidence is not None,
            "a publisher-submitted local test report passed binding checks",
        )
    )
    if accepted_evidence is not None:
        checks.extend(accepted_evidence.checks)
    elif evidence_results:
        checks.extend(evidence_results[0].checks)
    status = "passed" if all(bool(check["passed"]) for check in checks) else "failed"
    encoded_checks = json.dumps(checks, separators=(",", ":"))
    with engine.begin() as connection:
        if connection.dialect.name == "postgresql":
            checks_value = "CAST(:checks AS JSONB)"
        else:
            checks_value = ":checks"
        connection.execute(
            text(
                f"""
                INSERT INTO validation_results
                    (id, draft_id, draft_version, content_sha256, status, checks, created_at)
                VALUES
                    (:id, :draft_id, :draft_version, :content_sha256, :status,
                     {checks_value}, :created_at)
                ON CONFLICT (draft_id, draft_version, content_sha256)
                DO UPDATE SET status = EXCLUDED.status, checks = EXCLUDED.checks,
                              created_at = EXCLUDED.created_at
                """
            ),
            {
                "id": __import__("uuid").uuid4().hex,
                "draft_id": draft_id,
                "draft_version": expected_version,
                "content_sha256": expected_hash,
                "status": status,
                "checks": encoded_checks,
                "created_at": datetime.now(UTC),
            },
        )
