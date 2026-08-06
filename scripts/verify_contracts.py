from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import subprocess
import tarfile
import tempfile
from pathlib import Path

from jsonschema import Draft202012Validator

from vonk_catalog.api import create_app
from vonk_catalog.canonical import canonical_json, content_sha256


ROOT = Path(__file__).resolve().parents[1]
CONTRACT_FILES = (
    Path("schemas/recipe/v1.schema.json"),
    Path("schemas/problem/v1.schema.json"),
    Path("schemas/test-report/v1.schema.json"),
    Path("openapi/openapi.json"),
)


def verify() -> None:
    schemas = sorted((ROOT / "schemas").glob("*/*.schema.json"))
    for path in schemas:
        Draft202012Validator.check_schema(json.loads(path.read_text(encoding="utf-8")))

    recipe_schema = json.loads(
        (ROOT / "schemas/recipe/v1.schema.json").read_text(encoding="utf-8")
    )
    validator = Draft202012Validator(recipe_schema)
    manifest = json.loads(
        (ROOT / "schemas/fixtures/manifest.json").read_text(encoding="utf-8")
    )
    fixtures = sorted((ROOT / "schemas/fixtures").glob("recipe-v1-*.json"))
    if set(manifest) != {path.name for path in fixtures}:
        raise SystemExit("fixture manifest does not match the recipe fixture set")
    for path in fixtures:
        document = json.loads(path.read_text(encoding="utf-8"))
        validator.validate(document)
        if content_sha256(document) != manifest[path.name]:
            raise SystemExit(f"fixture hash is stale: {path.name}")

    expected_openapi = (
        json.dumps(
            create_app().openapi(), ensure_ascii=False, indent=2, sort_keys=True
        )
        + "\n"
    ).encode()
    actual_openapi = (ROOT / "openapi/openapi.json").read_bytes()
    if actual_openapi != expected_openapi:
        raise SystemExit("openapi/openapi.json is stale")

    generator = ROOT / "web/node_modules/.bin/openapi-typescript"
    if not generator.is_file():
        raise SystemExit("run npm --prefix web ci before contract verification")
    with tempfile.TemporaryDirectory(prefix="vonk-contract-") as directory:
        generated = Path(directory) / "schema.d.ts"
        subprocess.run(
            [str(generator), str(ROOT / "openapi/openapi.json"), "-o", str(generated)],
            cwd=ROOT,
            check=True,
        )
        if generated.read_bytes() != (ROOT / "web/src/api/schema.d.ts").read_bytes():
            raise SystemExit("web/src/api/schema.d.ts is stale")


def create_archive(destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    entries = list(CONTRACT_FILES)
    manifest = {
        str(path): hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
        for path in entries
    }
    entries.append(Path("contract-manifest.json"))
    with destination.open("wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode="w") as archive:
                for path in entries:
                    content = (
                        canonical_json(manifest) + b"\n"
                        if path.name == "contract-manifest.json"
                        else (ROOT / path).read_bytes()
                    )
                    info = tarfile.TarInfo(str(path))
                    info.size = len(content)
                    info.mode = 0o644
                    info.mtime = 0
                    info.uid = info.gid = 0
                    info.uname = info.gname = "root"
                    archive.addfile(info, io.BytesIO(content))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", type=Path)
    arguments = parser.parse_args()
    verify()
    if arguments.archive is not None:
        create_archive(arguments.archive)


if __name__ == "__main__":
    main()
