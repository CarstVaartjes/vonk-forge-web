from __future__ import annotations

import hashlib
import ipaddress
import json
import re
import socket
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from email.utils import parsedate_to_datetime
from urllib.parse import quote, urlencode, urljoin, urlsplit

import httpx

MAX_METADATA_BYTES = 1_048_576
MAX_REDIRECTS = 3
MANIFEST_ACCEPT = (
    "application/vnd.oci.image.index.v1+json, "
    "application/vnd.oci.image.manifest.v1+json, "
    "application/vnd.docker.distribution.manifest.list.v2+json, "
    "application/vnd.docker.distribution.manifest.v2+json"
)
DIGEST_RE = re.compile(r"^sha256:[a-f0-9]{64}$")
REFERENCE_RE = re.compile(
    r"^(?P<registry>[a-z0-9.-]+(?::[0-9]{1,5})?)/"
    r"(?P<repository>[A-Za-z0-9_./-]+)@(?P<digest>sha256:[a-f0-9]{64})$"
)


class RegistryProblem(RuntimeError):
    code = "registry.validation_failed"


class RegistryTemporaryProblem(RegistryProblem):
    code = "registry.temporarily_unavailable"

    def __init__(self, message: str, retry_after_seconds: int | None = None) -> None:
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds


Resolver = Callable[[str], Iterable[str]]


def _resolve(host: str) -> tuple[str, ...]:
    return tuple(
        sorted(
            {
                item[4][0]
                for item in socket.getaddrinfo(
                    host, 443, type=socket.SOCK_STREAM, proto=socket.IPPROTO_TCP
                )
            }
        )
    )


def _public_addresses(values: Iterable[str]) -> tuple[str, ...]:
    addresses = tuple(sorted(set(values)))
    if not addresses:
        raise RegistryProblem("registry host did not resolve")
    for raw in addresses:
        try:
            address = ipaddress.ip_address(raw)
        except ValueError as error:
            raise RegistryProblem("registry resolution is invalid") from error
        if not address.is_global:
            raise RegistryProblem(
                "registry endpoints and redirects must use public addresses"
            )
    return addresses


@dataclass(frozen=True, slots=True)
class ImageMetadata:
    submitted_digest: str
    manifest_digest: str
    architecture: str
    manifest_media_type: str
    config_media_type: str
    layer_media_types: tuple[str, ...]
    layer_bytes: int
    config_user: str | None
    labels: dict[str, str]


class RegistryClient:
    def __init__(
        self,
        *,
        client: httpx.Client | None = None,
        resolver: Resolver = _resolve,
    ) -> None:
        self.client = client or httpx.Client(
            timeout=httpx.Timeout(10.0, connect=5.0),
            follow_redirects=False,
            trust_env=False,
            headers={"User-Agent": "vonk-catalog-validator/1"},
        )
        self.resolver = resolver

    def _validate_url(self, url: str) -> tuple[str, ...]:
        parsed = urlsplit(url)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.fragment
        ):
            raise RegistryProblem("registry URLs must be credential-free public HTTPS")
        try:
            port = parsed.port
        except ValueError as error:
            raise RegistryProblem("registry URL port is invalid") from error
        if port is not None and not 1 <= port <= 65535:
            raise RegistryProblem("registry URL port is invalid")
        try:
            literal = ipaddress.ip_address(parsed.hostname)
        except ValueError:
            literal = None
        if literal is not None and not literal.is_global:
            raise RegistryProblem(
                "registry endpoints and redirects must use public addresses"
            )
        return _public_addresses(self.resolver(parsed.hostname))

    @staticmethod
    def _retry_after(response: httpx.Response) -> int | None:
        raw = response.headers.get("Retry-After")
        if raw is None:
            return None
        try:
            return min(3600, max(0, int(raw)))
        except ValueError:
            try:
                delay = (
                    parsedate_to_datetime(raw)
                    - parsedate_to_datetime(response.headers["Date"])
                ).total_seconds()
                return min(3600, max(0, int(delay)))
            except (KeyError, TypeError, ValueError):
                return None

    def _fetch(
        self, url: str, *, headers: dict[str, str] | None = None
    ) -> httpx.Response:
        current = url
        for redirects in range(MAX_REDIRECTS + 1):
            before = self._validate_url(current)
            try:
                request = self.client.build_request("GET", current, headers=headers)
                streamed = self.client.send(request, stream=True)
            except (httpx.TimeoutException, httpx.NetworkError) as error:
                raise RegistryTemporaryProblem(
                    "registry request timed out or failed"
                ) from error
            try:
                declared = streamed.headers.get("Content-Length")
                if declared is not None:
                    try:
                        if int(declared) > MAX_METADATA_BYTES:
                            raise RegistryProblem(
                                "registry metadata response is oversized"
                            )
                    except ValueError as error:
                        raise RegistryProblem(
                            "registry content length is invalid"
                        ) from error
                body = bytearray()
                for chunk in streamed.iter_bytes():
                    body.extend(chunk)
                    if len(body) > MAX_METADATA_BYTES:
                        raise RegistryProblem("registry metadata response is oversized")
                response = httpx.Response(
                    streamed.status_code,
                    headers=streamed.headers,
                    content=bytes(body),
                    request=request,
                )
            except (httpx.TimeoutException, httpx.NetworkError) as error:
                raise RegistryTemporaryProblem(
                    "registry response timed out or failed"
                ) from error
            finally:
                streamed.close()
            after = self._validate_url(current)
            if before != after:
                raise RegistryProblem("registry DNS answer changed during validation")
            if response.status_code in (301, 302, 303, 307, 308):
                if redirects >= MAX_REDIRECTS:
                    raise RegistryProblem("registry returned too many redirects")
                location = response.headers.get("Location")
                if not location:
                    raise RegistryProblem("registry redirect is missing a location")
                current = urljoin(current, location)
                continue
            if response.status_code == 429:
                raise RegistryTemporaryProblem(
                    "registry rate limit was reached", self._retry_after(response)
                )
            if response.status_code >= 500:
                raise RegistryTemporaryProblem("registry is temporarily unavailable")
            return response
        raise AssertionError("redirect loop escaped bound")

    @staticmethod
    def _bearer_challenge(response: httpx.Response) -> dict[str, str]:
        challenge = response.headers.get("WWW-Authenticate", "")
        if not challenge.lower().startswith("bearer "):
            raise RegistryProblem(
                "registry authentication requires unsupported credentials"
            )
        fields = dict(re.findall(r'(\w+)="([^"]*)"', challenge[7:]))
        realm = fields.get("realm")
        if realm is None:
            raise RegistryProblem("registry authentication challenge is invalid")
        return fields

    def _token(self, challenge: dict[str, str]) -> str:
        realm = challenge["realm"]
        query = {
            key: value
            for key in ("service", "scope")
            if (value := challenge.get(key)) is not None
        }
        separator = "&" if "?" in realm else "?"
        response = self._fetch(f"{realm}{separator}{urlencode(query)}")
        if response.status_code != 200:
            raise RegistryProblem("registry bearer authentication failed")
        payload = self._json(response)
        token = payload.get("token") or payload.get("access_token")
        if not isinstance(token, str) or not token or len(token) > 8192:
            raise RegistryProblem("registry bearer token is invalid")
        return token

    @staticmethod
    def _json(response: httpx.Response) -> dict[str, object]:
        try:
            payload = json.loads(response.content)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise RegistryProblem("registry metadata is invalid JSON") from error
        if not isinstance(payload, dict):
            raise RegistryProblem("registry metadata has an invalid shape")
        return payload

    def _metadata(
        self, url: str, *, expected_digest: str, accept: str
    ) -> tuple[dict[str, object], httpx.Response]:
        response = self._fetch(url, headers={"Accept": accept})
        if response.status_code == 401:
            token = self._token(self._bearer_challenge(response))
            response = self._fetch(
                url, headers={"Accept": accept, "Authorization": f"Bearer {token}"}
            )
        if response.status_code != 200:
            raise RegistryProblem(
                f"registry metadata request failed with status {response.status_code}"
            )
        actual = "sha256:" + hashlib.sha256(response.content).hexdigest()
        declared = response.headers.get("Docker-Content-Digest")
        if actual != expected_digest or (
            declared is not None and declared != expected_digest
        ):
            raise RegistryProblem(
                "registry content digest did not match the submitted digest"
            )
        return self._json(response), response

    def inspect(self, reference: str) -> ImageMetadata:
        matched = REFERENCE_RE.fullmatch(reference)
        if matched is None:
            raise RegistryProblem("container image must be digest-pinned")
        registry = matched["registry"]
        repository = matched["repository"].strip("/")
        submitted = matched["digest"]
        if ".." in repository.split("/") or not repository:
            raise RegistryProblem("container repository is invalid")
        base = f"https://{registry}/v2/{quote(repository, safe='/')}/"
        index, _ = self._metadata(
            f"{base}manifests/{submitted}",
            expected_digest=submitted,
            accept=MANIFEST_ACCEPT,
        )
        media_type = index.get("mediaType")
        if not isinstance(media_type, str):
            raise RegistryProblem("registry manifest media type is missing")
        selected_digest = submitted
        manifest = index
        if media_type in {
            "application/vnd.oci.image.index.v1+json",
            "application/vnd.docker.distribution.manifest.list.v2+json",
        }:
            manifests = index.get("manifests")
            if not isinstance(manifests, list):
                raise RegistryProblem("registry image index is invalid")
            selected = next(
                (
                    item
                    for item in manifests
                    if isinstance(item, dict)
                    and isinstance(item.get("platform"), dict)
                    and item["platform"].get("os") == "linux"
                    and item["platform"].get("architecture") == "arm64"
                    and isinstance(item.get("digest"), str)
                ),
                None,
            )
            if selected is None or not DIGEST_RE.fullmatch(str(selected["digest"])):
                raise RegistryProblem(
                    "container image does not provide a linux/ARM64 manifest"
                )
            selected_digest = str(selected["digest"])
            manifest, _ = self._metadata(
                f"{base}manifests/{selected_digest}",
                expected_digest=selected_digest,
                accept=MANIFEST_ACCEPT,
            )
        config_descriptor = manifest.get("config")
        layers = manifest.get("layers")
        if not isinstance(config_descriptor, dict) or not isinstance(layers, list):
            raise RegistryProblem("container image manifest is incomplete")
        config_digest = config_descriptor.get("digest")
        if not isinstance(config_digest, str) or not DIGEST_RE.fullmatch(config_digest):
            raise RegistryProblem("container config digest is invalid")
        config, _ = self._metadata(
            f"{base}blobs/{config_digest}",
            expected_digest=config_digest,
            accept="application/vnd.oci.image.config.v1+json",
        )
        if config.get("os") != "linux" or config.get("architecture") != "arm64":
            raise RegistryProblem("container config is not linux/ARM64")
        layer_bytes = 0
        layer_media_types: list[str] = []
        for layer in layers:
            if (
                not isinstance(layer, dict)
                or not isinstance(layer.get("size"), int)
                or layer["size"] < 0
            ):
                raise RegistryProblem("container layer metadata is invalid")
            layer_bytes += layer["size"]
            if layer_bytes > 10**15:
                raise RegistryProblem("container layer size is unreasonable")
            layer_media_types.append(str(layer.get("mediaType", "unknown"))[:255])
        runtime_config = config.get("config")
        runtime_config = runtime_config if isinstance(runtime_config, dict) else {}
        user = runtime_config.get("User")
        labels = runtime_config.get("Labels")
        safe_labels = {
            key[:255]: value[:2048]
            for key, value in (labels.items() if isinstance(labels, dict) else ())
            if isinstance(key, str) and isinstance(value, str)
        }
        return ImageMetadata(
            submitted_digest=submitted,
            manifest_digest=selected_digest,
            architecture="linux/arm64",
            manifest_media_type=str(manifest.get("mediaType", media_type))[:255],
            config_media_type=str(config_descriptor.get("mediaType", "unknown"))[:255],
            layer_media_types=tuple(layer_media_types),
            layer_bytes=layer_bytes,
            config_user=user[:255] if isinstance(user, str) else None,
            labels=safe_labels,
        )
