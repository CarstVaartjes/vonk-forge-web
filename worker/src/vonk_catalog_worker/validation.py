from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker
from sqlalchemy import Engine, text

from .leases import LeasedJob
from .registry import RegistryClient

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


def validate_resource_envelope(
    document: dict[str, object], *, artifact_sizes: list[int]
) -> tuple[dict[str, object], ...]:
    try:
        artifacts = document["artifacts"]
        download_by_id = {
            str(artifact["id"]): int(artifact["download_bytes"])
            for artifact in artifacts
        }
        declared_artifact_sizes = list(download_by_id.values())
        installed_by_id = {
            str(artifact["id"]): int(artifact["installed_bytes"])
            for artifact in artifacts
        }
        profiles = document["deployment_profiles"]
    except (KeyError, TypeError, ValueError) as error:
        raise ValidationJobProblem("draft resource envelope is invalid") from error
    if len(artifact_sizes) != len(declared_artifact_sizes):
        raise ValidationJobProblem("artifact size observations are incomplete")
    profiles_cover_artifacts = True
    staging_covers_download = True
    for profile in profiles:
        for role in profile["roles"]:
            disk = role["resources"]["disk"]
            required = sum(
                installed_by_id[identifier] for identifier in role["artifacts"]
            )
            profiles_cover_artifacts &= int(disk["artifact_bytes"]) >= required
            staging_covers_download &= int(disk["staging_bytes"]) >= max(
                (download_by_id[identifier] for identifier in role["artifacts"]),
                default=0,
            )
    return (
        _check(
            "resources.artifact_sizes",
            declared_artifact_sizes == artifact_sizes,
            "declared immutable artifact sizes match independently observed metadata",
        ),
        _check(
            "resources.profile_artifact_bytes",
            profiles_cover_artifacts,
            "every role's disk envelope covers its immutable installed artifacts",
        ),
        _check(
            "resources.profile_staging_bytes",
            staging_covers_download,
            "every role's staging envelope covers its largest artifact download",
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
    source_bundle_sha256: str,
    deployment_profiles: dict[str, int],
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
            "evidence.source_bundle_mismatch",
            report.get("source_bundle_sha256") == source_bundle_sha256,
            "report is bound to the published source bundle",
        )
    )
    node_count = report.get("node_count")
    profile = report.get("deployment_profile")
    checks.append(
        _check(
            "evidence.node_count_unverified",
            isinstance(profile, str)
            and isinstance(node_count, int)
            and deployment_profiles.get(profile) == node_count,
            "report names an exact recipe deployment profile and node count",
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
        build = document["build"]
        source_bundle_sha256 = build["context"]["sha256"]
        deployment_profiles = {
            str(profile["name"]): int(profile["node_count"])
            for profile in document["deployment_profiles"]
        }
    except (KeyError, TypeError) as error:
        raise ValidationJobProblem(
            "draft source or deployment profiles are invalid"
        ) from error
    with engine.connect() as connection:
        source = connection.execute(
            text("SELECT manifest FROM source_bundles WHERE sha256 = :sha256"),
            {"sha256": source_bundle_sha256},
        ).scalar_one_or_none()
    if source is None:
        raise ValidationJobProblem("draft source bundle is unavailable")
    if isinstance(source, str):
        source = json.loads(source)
    files = source.get("files") if isinstance(source, dict) else None
    dockerfile = build.get("dockerfile") if isinstance(build, dict) else None
    source_files = (
        {item.get("path") for item in files if isinstance(item, dict)}
        if isinstance(files, list)
        else set()
    )
    checks: list[dict[str, object]] = [
        _check(
            "source.bundle_verified",
            True,
            "canonical source bundle digest is present in the catalog",
        ),
        _check(
            "source.dockerfile_present",
            isinstance(dockerfile, str) and dockerfile in source_files,
            "the declared Dockerfile exists in the verified source manifest",
        ),
    ]
    raw_artifacts = document.get("artifacts")
    if not isinstance(raw_artifacts, list) or not all(
        isinstance(artifact, dict) for artifact in raw_artifacts
    ):
        raise ValidationJobProblem("draft artifacts are invalid")
    artifact_sizes = [registry.observe_artifact(artifact) for artifact in raw_artifacts]
    checks.append(
        {
            "code": "registry.artifact_metadata_observed",
            "passed": True,
            "detail": "immutable artifact sizes were independently observed",
            "observed": {"artifact_sizes": artifact_sizes},
        }
    )
    checks.extend(
        validate_resource_envelope(
            document,
            artifact_sizes=artifact_sizes,
        )
    )
    evidence_results: list[EvidenceValidation] = []
    for raw in reports[:20]:
        report = json.loads(raw) if isinstance(raw, str) else raw
        if isinstance(report, dict):
            evidence_results.append(
                validate_test_evidence(
                    report,
                    recipe_sha256=expected_hash,
                    source_bundle_sha256=source_bundle_sha256,
                    deployment_profiles=deployment_profiles,
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
