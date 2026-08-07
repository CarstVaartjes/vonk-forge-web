import hashlib
import json
import socket
import ssl
import subprocess
import threading

import httpx
import pytest
import vonk_catalog_worker.registry as registry_module
from vonk_catalog_worker.registry import (
    PinnedNetworkBackend,
    RegistryClient,
    RegistryProblem,
    RegistryTemporaryProblem,
)

CONFIG_BODY = json.dumps(
    {
        "architecture": "arm64",
        "os": "linux",
        "config": {
            "User": "10001",
            "Labels": {
                "org.opencontainers.image.source": "https://example.test/source"
            },
        },
    },
    separators=(",", ":"),
).encode()
CONFIG = "sha256:" + hashlib.sha256(CONFIG_BODY).hexdigest()
CHILD_BODY = json.dumps(
    {
        "schemaVersion": 2,
        "mediaType": "application/vnd.oci.image.manifest.v1+json",
        "config": {
            "digest": CONFIG,
            "size": len(CONFIG_BODY),
            "mediaType": "application/vnd.oci.image.config.v1+json",
        },
        "layers": [
            {
                "digest": "sha256:" + "d" * 64,
                "size": 456,
                "mediaType": "application/vnd.oci.image.layer.v1.tar+gzip",
            }
        ],
    },
    separators=(",", ":"),
).encode()
CHILD = "sha256:" + hashlib.sha256(CHILD_BODY).hexdigest()
INDEX_BODY = json.dumps(
    {
        "schemaVersion": 2,
        "mediaType": "application/vnd.oci.image.index.v1+json",
        "manifests": [
            {
                "mediaType": "application/vnd.oci.image.manifest.v1+json",
                "digest": CHILD,
                "size": len(CHILD_BODY),
                "platform": {"os": "linux", "architecture": "arm64"},
            }
        ],
    },
    separators=(",", ":"),
).encode()
DIGEST = "sha256:" + hashlib.sha256(INDEX_BODY).hexdigest()
ARTIFACT_BODY = json.dumps(
    {
        "schemaVersion": 2,
        "mediaType": "application/vnd.oci.image.manifest.v1+json",
        "layers": [{"digest": "sha256:" + "e" * 64, "size": 321}],
    },
    separators=(",", ":"),
).encode()
ARTIFACT_DIGEST = "sha256:" + hashlib.sha256(ARTIFACT_BODY).hexdigest()
PUBLIC_IP = ("93.184.216.34",)


class RecordingBackend:
    def __init__(self) -> None:
        self.hosts: list[tuple[str, int]] = []

    def connect_tcp(self, host, port, **kwargs):
        self.hosts.append((host, port))
        return object()

    def connect_unix_socket(self, path, **kwargs):
        raise AssertionError(path)

    def sleep(self, seconds):
        raise AssertionError(seconds)


def test_pinned_backend_connects_to_validated_ip_not_a_second_dns_answer() -> None:
    underlying = RecordingBackend()
    backend = PinnedNetworkBackend(
        {"registry.example": "93.184.216.34"}, backend=underlying
    )

    stream = backend.connect_tcp("registry.example", 443, timeout=1.0)

    assert stream is not None
    assert underlying.hosts == [("93.184.216.34", 443)]


def _response(request: httpx.Request) -> httpx.Response:
    if request.url.path.endswith(f"/manifests/{DIGEST}"):
        return httpx.Response(
            200,
            content=INDEX_BODY,
            headers={"Docker-Content-Digest": DIGEST},
            request=request,
        )
    if request.url.path.endswith(f"/manifests/{CHILD}"):
        return httpx.Response(
            200,
            content=CHILD_BODY,
            headers={"Docker-Content-Digest": CHILD},
            request=request,
        )
    if request.url.path.endswith(f"/blobs/{CONFIG}"):
        return httpx.Response(200, content=CONFIG_BODY, request=request)
    raise AssertionError(request.url)


def _client(handler=_response, resolver=lambda _: PUBLIC_IP) -> RegistryClient:
    return RegistryClient(
        client=httpx.Client(transport=httpx.MockTransport(handler), trust_env=False),
        resolver=resolver,
    )


def test_resolves_digest_index_arm64_and_only_reads_config_metadata() -> None:
    result = _client().inspect(f"registry.example/org/image@{DIGEST}")
    assert result.submitted_digest == DIGEST
    assert result.manifest_digest == CHILD
    assert result.architecture == "linux/arm64"
    assert result.layer_bytes == 456
    assert result.config_user == "10001"
    assert (
        result.labels["org.opencontainers.image.source"]
        == "https://example.test/source"
    )


def test_artifact_sizes_are_observed_from_independent_remote_metadata() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "HEAD":
            return httpx.Response(
                200, headers={"Content-Length": "123"}, request=request
            )
        if request.url.host == "huggingface.co":
            assert request.url.params["blobs"] == "true"
            assert request.headers["Accept-Encoding"] == "identity"
            return httpx.Response(
                200,
                json={
                    "siblings": [
                        {"rfilename": ".gitattributes", "size": 123},
                        {
                            "rfilename": "weights.safetensors",
                            "size": 456,
                            "lfs": {"size": 456},
                        },
                    ]
                },
                request=request,
            )
        if request.url.path.endswith(f"/manifests/{ARTIFACT_DIGEST}"):
            return httpx.Response(
                200,
                content=ARTIFACT_BODY,
                headers={"Docker-Content-Digest": ARTIFACT_DIGEST},
                request=request,
            )
        raise AssertionError(request.url)

    client = _client(handler)
    assert (
        client.observe_artifact(
            {
                "kind": "http.file",
                "repository": "https://models.example/weights.bin",
                "revision": "sha256:" + "a" * 64,
            }
        )
        == 123
    )
    assert (
        client.observe_artifact(
            {
                "kind": "huggingface.snapshot",
                "repository": "owner/model",
                "revision": "b" * 40,
            }
        )
        == 579
    )
    assert (
        client.observe_artifact(
            {
                "kind": "oci.artifact",
                "repository": "ghcr.io/owner/model",
                "revision": ARTIFACT_DIGEST,
            }
        )
        == 321
    )


def test_rejects_mutable_tag_missing_arm64_and_digest_mismatch() -> None:
    with pytest.raises(RegistryProblem, match="digest-pinned"):
        _client().inspect("registry.example/org/image:latest")

    missing_body = json.dumps(
        {
            "schemaVersion": 2,
            "mediaType": "application/vnd.oci.image.index.v1+json",
            "manifests": [],
        },
        separators=(",", ":"),
    ).encode()
    missing_digest = "sha256:" + hashlib.sha256(missing_body).hexdigest()

    def missing(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            content=missing_body,
            headers={"Docker-Content-Digest": missing_digest},
            request=request,
        )

    with pytest.raises(RegistryProblem, match="ARM64"):
        _client(missing).inspect(f"registry.example/org/image@{missing_digest}")

    def mismatch(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={},
            headers={"Docker-Content-Digest": "sha256:" + "f" * 64},
            request=request,
        )

    with pytest.raises(RegistryProblem, match="digest"):
        _client(mismatch).inspect(f"registry.example/org/image@{DIGEST}")


def test_rejects_private_redirect_dns_rebinding_oversize_and_rate_limit() -> None:
    def redirect(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            307,
            headers={"Location": "https://169.254.169.254/latest/meta-data"},
            request=request,
        )

    with pytest.raises(RegistryProblem, match="public"):
        _client(redirect).inspect(f"registry.example/org/image@{DIGEST}")

    calls = [PUBLIC_IP, ("127.0.0.1",)]
    with pytest.raises(RegistryProblem, match="public"):
        _client(resolver=lambda _: calls.pop(0) if calls else ("127.0.0.1",)).inspect(
            f"registry.example/org/image@{DIGEST}"
        )

    def oversized(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"x" * 1_048_577, request=request)

    with pytest.raises(RegistryProblem, match="oversized"):
        _client(oversized).inspect(f"registry.example/org/image@{DIGEST}")

    def rate_limited(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, headers={"Retry-After": "17"}, request=request)

    with pytest.raises(RegistryTemporaryProblem) as error:
        _client(rate_limited).inspect(f"registry.example/org/image@{DIGEST}")
    assert error.value.retry_after_seconds == 17

    def timeout(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out", request=request)

    with pytest.raises(RegistryTemporaryProblem, match="timed out"):
        _client(timeout).inspect(f"registry.example/org/image@{DIGEST}")


def test_request_transport_pins_tcp_while_preserving_tls_hostname(
    tmp_path, monkeypatch
) -> None:
    key = tmp_path / "key.pem"
    certificate = tmp_path / "certificate.pem"
    subprocess.run(
        [
            "openssl",
            "req",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-nodes",
            "-keyout",
            str(key),
            "-out",
            str(certificate),
            "-days",
            "1",
            "-subj",
            "/CN=registry.example",
            "-addext",
            "subjectAltName=DNS:registry.example",
        ],
        check=True,
        capture_output=True,
    )
    server_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    server_context.load_cert_chain(certificate, key)
    observed_sni: list[str | None] = []
    server_context.sni_callback = lambda _socket, name, _context: observed_sni.append(
        name
    )
    listener = socket.create_server(("127.0.0.1", 0))
    port = listener.getsockname()[1]

    def serve() -> None:
        connection, _ = listener.accept()
        with (
            connection,
            server_context.wrap_socket(connection, server_side=True) as tls,
        ):
            request = bytearray()
            while b"\r\n\r\n" not in request:
                request.extend(tls.recv(4096))
            tls.sendall(
                b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}"
            )
        listener.close()

    server = threading.Thread(target=serve)
    server.start()
    client_context = ssl.create_default_context(cafile=str(certificate))
    monkeypatch.setattr(httpx, "create_ssl_context", lambda **_kwargs: client_context)
    monkeypatch.setattr(
        registry_module, "_public_addresses", lambda values: tuple(values)
    )

    response = RegistryClient(resolver=lambda _host: ("127.0.0.1",))._fetch(
        f"https://registry.example:{port}/v2/"
    )

    server.join(timeout=5)
    assert not server.is_alive()
    assert response.json() == {}
    assert observed_sni == ["registry.example"]


@pytest.mark.parametrize("invalid_size", [-1, True])
def test_oci_artifact_rejects_negative_and_boolean_descriptor_sizes(
    invalid_size,
) -> None:
    body = json.dumps(
        {
            "schemaVersion": 2,
            "mediaType": "application/vnd.oci.image.manifest.v1+json",
            "layers": [
                {"digest": "sha256:" + "e" * 64, "size": 321},
                {"digest": "sha256:" + "f" * 64, "size": invalid_size},
            ],
        },
        separators=(",", ":"),
    ).encode()
    digest = "sha256:" + hashlib.sha256(body).hexdigest()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            content=body,
            headers={"Docker-Content-Digest": digest},
            request=request,
        )

    with pytest.raises(RegistryProblem, match="size metadata"):
        _client(handler).observe_artifact(
            {
                "kind": "oci.artifact",
                "repository": "ghcr.io/owner/model",
                "revision": digest,
            }
        )


def test_bearer_auth_is_public_bounded_and_does_not_accept_basic_credentials() -> None:
    token = "registry-token"

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "auth.example":
            assert request.url.params["scope"] == "repository:org/image:pull"
            return httpx.Response(
                200, json={"token": token, "expires_in": 300}, request=request
            )
        if request.headers.get("Authorization") == f"Bearer {token}":
            return _response(request)
        return httpx.Response(
            401,
            headers={
                "WWW-Authenticate": 'Bearer realm="https://auth.example/token",service="registry.example",scope="repository:org/image:pull"'
            },
            request=request,
        )

    assert (
        _client(handler).inspect(f"registry.example/org/image@{DIGEST}").manifest_digest
        == CHILD
    )

    def basic(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            401, headers={"WWW-Authenticate": 'Basic realm="registry"'}, request=request
        )

    with pytest.raises(RegistryProblem, match="authentication"):
        _client(basic).inspect(f"registry.example/org/image@{DIGEST}")
