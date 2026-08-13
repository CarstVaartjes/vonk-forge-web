from __future__ import annotations

import json
import os
from collections.abc import Mapping, Sequence
from pathlib import Path

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError


class RecipeContractError(ValueError):
    """A stable, user-correctable recipe contract error."""


def _schema_path() -> Path:
    return contract_path("recipe", "v1.schema.json")


def contract_path(*parts: str) -> Path:
    configured = os.environ.get("VONK_CONTRACT_ROOT")
    root = (
        Path(configured)
        if configured is not None
        else Path(__file__).resolve().parents[3] / "schemas"
    )
    path = root.joinpath(*parts)
    if not path.is_file():
        raise RuntimeError(f"required contract is not installed: {'/'.join(parts)}")
    return path


def recipe_validator() -> Draft202012Validator:
    schema = json.loads(_schema_path().read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def validate_recipe(document: Mapping[str, object]) -> None:
    errors = sorted(
        recipe_validator().iter_errors(document),
        key=lambda error: tuple(str(part) for part in error.absolute_path),
    )
    if errors:
        error = _most_specific(errors[0])
        path = ".".join(str(part) for part in error.absolute_path) or "$"
        raise RecipeContractError(f"{path}: {error.message}")
    _validate_recipe_semantics(document)


def deployment_profile(
    document: Mapping[str, object], name: str
) -> Mapping[str, object]:
    profiles = document.get("deployment_profiles")
    if not isinstance(profiles, Sequence) or isinstance(profiles, (str, bytes)):
        raise RecipeContractError("deployment_profiles: profiles are required")
    matches = [
        profile
        for profile in profiles
        if isinstance(profile, Mapping) and profile.get("name") == name
    ]
    if len(matches) != 1:
        raise RecipeContractError(
            "deployment_profiles: profile name is missing or not unique"
        )
    return matches[0]


def recipe_problems(document: Mapping[str, object]) -> list[dict[str, object]]:
    """Return bounded, stable problem paths without echoing submitted values."""
    errors = sorted(
        recipe_validator().iter_errors(document),
        key=lambda error: tuple(str(part) for part in error.absolute_path),
    )
    problems: list[dict[str, object]] = []
    for raw in errors[:50]:
        error = _most_specific(raw)
        path = ".".join(str(part) for part in error.absolute_path) or "$"
        problems.append(
            {
                "path": path,
                "rule": str(error.validator),
                "message": error.message[:512],
            }
        )
    if not problems:
        try:
            _validate_recipe_semantics(document)
        except RecipeContractError as error:
            detail = str(error)
            path, _, message = detail.partition(": ")
            problems.append(
                {
                    "path": path or "$",
                    "rule": "semantic",
                    "message": (message or detail)[:512],
                }
            )
    return problems


def _validate_recipe_semantics(document: Mapping[str, object]) -> None:
    parameters = _mapping_sequence(document.get("parameters"), "parameters")
    parameter_names = _unique_names(parameters, "parameters")
    for index, parameter in enumerate(parameters):
        default = parameter.get("default")
        kind = parameter.get("type")
        if (
            (kind == "integer" and (not isinstance(default, int) or isinstance(default, bool)))
            or (kind == "boolean" and not isinstance(default, bool))
            or (kind in {"string", "enum"} and not isinstance(default, str))
        ):
            raise RecipeContractError(
                f"parameters.{index}.default: default does not match parameter type"
            )
        minimum = parameter.get("minimum")
        maximum = parameter.get("maximum")
        if isinstance(minimum, int) and isinstance(maximum, int) and minimum > maximum:
            raise RecipeContractError(
                f"parameters.{index}: minimum exceeds maximum"
            )
        allowed = parameter.get("allowed_values")
        if kind == "enum" and (
            not isinstance(allowed, Sequence) or default not in allowed
        ):
            raise RecipeContractError(
                f"parameters.{index}.allowed_values: enum default must be allowed"
            )

    artifacts = _mapping_sequence(document.get("artifacts"), "artifacts")
    artifact_ids = _unique_field(artifacts, "id", "artifacts")
    runtime = document.get("runtime")
    if not isinstance(runtime, Mapping):
        raise RecipeContractError("runtime: runtime is required")
    arguments = _mapping_sequence(runtime.get("arguments"), "runtime.arguments")
    for index, argument in enumerate(arguments):
        parameter = argument.get("parameter")
        if parameter is not None and parameter not in parameter_names:
            raise RecipeContractError(
                f"runtime.arguments.{index}.parameter: parameter does not exist"
            )

    profiles = _mapping_sequence(
        document.get("deployment_profiles"), "deployment_profiles"
    )
    _unique_field(profiles, "name", "deployment_profiles")
    security = runtime.get("security")
    host_network = (
        isinstance(security, Mapping) and security.get("host_network") is True
    )
    all_role_names: set[object] = set()
    for profile_index, profile in enumerate(profiles):
        path = f"deployment_profiles.{profile_index}"
        roles = _mapping_sequence(profile.get("roles"), f"{path}.roles")
        role_names = _unique_field(roles, "name", f"{path}.roles")
        all_role_names.update(role_names)
        node_count = profile.get("node_count")
        if sum(int(role["count"]) for role in roles) != node_count:
            raise RecipeContractError(
                f"{path}.node_count: role counts must equal node_count"
            )
        owners = [role for role in roles if role.get("endpoint_owner") is True]
        if len(owners) != 1 or owners[0].get("count") != 1:
            raise RecipeContractError(
                f"{path}.roles: exactly one single-node role must own the endpoint"
            )
        parallelism = profile.get("parallelism")
        if not isinstance(parallelism, Mapping):
            raise RecipeContractError(f"{path}.parallelism: parallelism is required")
        world_size = (
            int(parallelism["tensor"])
            * int(parallelism["pipeline"])
            * int(parallelism["data"])
        )
        if world_size != node_count:
            raise RecipeContractError(
                f"{path}.parallelism: parallelism product must equal node_count"
            )
        fabric = profile.get("fabric")
        if not isinstance(fabric, Mapping):
            raise RecipeContractError(f"{path}.fabric: fabric is required")
        connectivity = fabric.get("connectivity")
        if (node_count == 1) != (connectivity == "none"):
            raise RecipeContractError(
                f"{path}.fabric: only a one-node profile may use no fabric"
            )
        if host_network and (
            not isinstance(node_count, int)
            or isinstance(node_count, bool)
            or node_count < 2
            or connectivity == "none"
        ):
            raise RecipeContractError(
                f"{path}: host network requires a connected multi-node profile"
            )
        overrides = profile.get("parameter_overrides")
        if not isinstance(overrides, Mapping) or not set(overrides).issubset(
            parameter_names
        ):
            raise RecipeContractError(
                f"{path}.parameter_overrides: override parameter does not exist"
            )
        for role_index, role in enumerate(roles):
            unknown_artifacts = set(role.get("artifacts", ())) - artifact_ids
            if unknown_artifacts:
                raise RecipeContractError(
                    f"{path}.roles.{role_index}.artifacts: artifact does not exist"
                )

    for index, artifact in enumerate(artifacts):
        unknown_roles = set(artifact.get("roles", ())) - all_role_names
        if unknown_roles:
            raise RecipeContractError(
                f"artifacts.{index}.roles: role does not exist in a profile"
            )


def _mapping_sequence(value: object, path: str) -> list[Mapping[str, object]]:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
        raise RecipeContractError(f"{path}: array is required")
    if not all(isinstance(item, Mapping) for item in value):
        raise RecipeContractError(f"{path}: object entries are required")
    return list(value)  # type: ignore[arg-type]


def _unique_names(values: Sequence[Mapping[str, object]], path: str) -> set[object]:
    return _unique_field(values, "name", path)


def _unique_field(
    values: Sequence[Mapping[str, object]], field: str, path: str
) -> set[object]:
    names = [value.get(field) for value in values]
    if len(names) != len(set(names)):
        raise RecipeContractError(f"{path}: {field} values must be unique")
    return set(names)


def _most_specific(error: ValidationError) -> ValidationError:
    candidates = [error]
    pending = list(error.context)
    while pending:
        candidate = pending.pop()
        candidates.append(candidate)
        pending.extend(candidate.context)
    return max(
        candidates,
        key=lambda candidate: (
            candidate.validator == "required",
            len(candidate.absolute_path),
            -len(candidate.context),
        ),
    )
