from __future__ import annotations

import json
from collections.abc import Mapping
from pathlib import Path

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError


class RecipeContractError(ValueError):
    """A stable, user-correctable recipe contract error."""


def _schema_path() -> Path:
    return Path(__file__).resolve().parents[3] / "schemas" / "recipe" / "v1.schema.json"


def recipe_validator() -> Draft202012Validator:
    schema = json.loads(_schema_path().read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def validate_recipe(document: Mapping[str, object]) -> None:
    errors = sorted(
        recipe_validator().iter_errors(document),
        key=lambda error: tuple(str(part) for part in error.absolute_path),
    )
    if not errors:
        return
    error = _most_specific(errors[0])
    path = ".".join(str(part) for part in error.absolute_path) or "$"
    raise RecipeContractError(f"{path}: {error.message}")


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
