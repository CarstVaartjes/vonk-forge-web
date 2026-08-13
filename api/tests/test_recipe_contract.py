import copy
import json
from pathlib import Path

import pytest

from vonk_catalog.contracts import (
    RecipeContractError,
    deployment_profile,
    validate_recipe,
)


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
        (("build", "dockerfile", "../Dockerfile"), "dockerfile"),
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


def test_multinode_recipe_supports_three_nodes_without_rank_records() -> None:
    recipe = copy.deepcopy(fixture("recipe-v1-multinode.json"))
    profile = deployment_profile(recipe, "triple-tp3")

    assert profile["node_count"] == 3
    assert sum(role["count"] for role in profile["roles"]) == 3


def test_recipe_requires_standard_runtime_interface_and_confinement() -> None:
    recipe = fixture("recipe-v1-minimal.json")
    runtime = recipe["runtime"]
    security = runtime["security"]
    assert isinstance(runtime, dict) and isinstance(security, dict)

    runtime["interface"] = "publisher-specific.v1"
    with pytest.raises(RecipeContractError, match="interface"):
        validate_recipe(recipe)

    runtime["interface"] = "vonk.runtime.v1"
    security["privileged"] = True
    with pytest.raises(RecipeContractError, match="privileged"):
        validate_recipe(recipe)


def test_host_network_is_reserved_for_connected_multinode_profiles() -> None:
    multinode = fixture("recipe-v1-multinode.json")
    multinode["runtime"]["security"]["host_network"] = True

    validate_recipe(multinode)

    single = fixture("recipe-v1-minimal.json")
    single["runtime"]["security"]["host_network"] = True
    with pytest.raises(RecipeContractError, match="connected multi-node"):
        validate_recipe(single)


def test_profile_role_counts_and_endpoint_owner_are_semantic() -> None:
    recipe = fixture("recipe-v1-multinode.json")
    profile = recipe["deployment_profiles"][0]
    profile["roles"][1]["count"] = 1
    profile["roles"][1]["endpoint_owner"] = True

    with pytest.raises(RecipeContractError, match="node_count|endpoint"):
        validate_recipe(recipe)
