from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping, Sequence
from typing import Any


def _reject_float(_: str) -> None:
    raise ValueError("floats are not permitted in contract documents")


def _reject_constant(_: str) -> None:
    raise ValueError("floats are not permitted in contract documents")


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate object key: {key}")
        result[key] = value
    return result


def parse_json(payload: bytes | str) -> object:
    return json.loads(
        payload,
        object_pairs_hook=_unique_object,
        parse_float=_reject_float,
        parse_constant=_reject_constant,
    )


def _assert_contract_value(value: object, path: str = "$") -> None:
    if isinstance(value, float):
        raise ValueError(f"floats are not permitted in contract documents at {path}")
    if value is None or isinstance(value, (str, bool, int)):
        return
    if isinstance(value, Mapping):
        for key, child in value.items():
            if not isinstance(key, str):
                raise ValueError(f"object keys must be strings at {path}")
            _assert_contract_value(child, f"{path}.{key}")
        return
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        for index, child in enumerate(value):
            _assert_contract_value(child, f"{path}[{index}]")
        return
    raise ValueError(f"unsupported contract value at {path}: {type(value).__name__}")


def canonical_json(value: object) -> bytes:
    _assert_contract_value(value)
    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def content_sha256(value: object) -> str:
    return hashlib.sha256(canonical_json(value)).hexdigest()
