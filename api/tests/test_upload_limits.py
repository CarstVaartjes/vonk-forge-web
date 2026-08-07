import json
from pathlib import Path

import pytest
from vonk_catalog.drafts import decode_upload
from vonk_catalog.problems import Problem

FIXTURE = (
    Path(__file__).resolve().parents[2] / "schemas/fixtures/recipe-v1-minimal.json"
)


def test_upload_rejects_binary_multipart_oversize_duplicate_keys_and_deep_json() -> (
    None
):
    recipe = json.loads(FIXTURE.read_text())
    valid = json.dumps({"recipe": recipe}).encode()
    assert decode_upload(valid, "application/json")["recipe"] == recipe

    cases = [
        (valid, "multipart/form-data; boundary=x", "draft.content_type_invalid"),
        (b"x" * (1_048_576 + 1), "application/json", "draft.body_too_large"),
        (b'{"recipe":{},"recipe":{}}', "application/json", "draft.json_invalid"),
        (
            json.dumps(
                {"recipe": [[[[[[[[[[[[[[[[[[[[[1]]]]]]]]]]]]]]]]]]]]]}
            ).encode(),
            "application/json",
            "draft.structure_too_complex",
        ),
    ]
    for body, content_type, code in cases:
        with pytest.raises(Problem) as error:
            decode_upload(body, content_type)
        assert error.value.code == code


def test_upload_allows_only_recipe_and_test_report_envelope() -> None:
    recipe = json.loads(FIXTURE.read_text())
    for envelope in (
        {"recipe": recipe, "container": "bytes"},
        {"recipe": recipe, "weights": ["embedded"]},
        {"recipe": recipe, "fetch_url": "https://example.test/archive.tar"},
    ):
        with pytest.raises(Problem) as error:
            decode_upload(json.dumps(envelope).encode(), "application/json")
        assert error.value.code == "draft.envelope_invalid"
