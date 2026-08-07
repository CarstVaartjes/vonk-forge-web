from fastapi.testclient import TestClient

from vonk_catalog.api import create_app


def test_liveness_has_stable_contract() -> None:
    response = TestClient(create_app()).get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"service": "vonk-catalog-api", "status": "live"}


def test_readiness_reports_database_failure() -> None:
    def unavailable_probe() -> None:
        raise ConnectionError("database unavailable")

    response = TestClient(create_app(readiness_probe=unavailable_probe)).get(
        "/health/ready"
    )

    assert response.status_code == 503
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json() == {
        "type": "https://api.vonkforge.ai/problems/catalog.database_unavailable",
        "title": "Catalog database unavailable",
        "status": 503,
        "code": "catalog.database_unavailable",
        "detail": "The catalog database is not ready.",
    }
