import math

import pytest

from vonk_catalog.canonical import canonical_json, content_sha256, parse_json


def test_canonical_json_sorts_keys_and_has_no_whitespace() -> None:
    assert canonical_json({"z": 1, "a": [True, None]}) == b'{"a":[true,null],"z":1}'


def test_content_hash_is_lowercase_sha256() -> None:
    assert content_sha256({"a": 1}) == (
        "015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862"
    )


@pytest.mark.parametrize("value", [1.25, math.nan, math.inf])
def test_canonical_json_rejects_floats(value: float) -> None:
    with pytest.raises(ValueError, match="floats are not permitted"):
        canonical_json({"value": value})


def test_parser_rejects_duplicate_object_keys() -> None:
    with pytest.raises(ValueError, match="duplicate object key: identity"):
        parse_json(b'{"identity":{},"identity":{}}')
