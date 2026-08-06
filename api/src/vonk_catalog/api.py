from collections.abc import Callable

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from .problems import install_problem_handling
from .public_api import SessionProvider, build_public_router


ReadinessProbe = Callable[[], None]


def _ready() -> None:
    """Default probe used before database wiring is configured."""


def create_app(
    readiness_probe: ReadinessProbe = _ready,
    database_sessions: SessionProvider | None = None,
) -> FastAPI:
    app = FastAPI(title="Vonk Forge Catalog API", version="1.0.0")
    install_problem_handling(app)

    @app.get("/health/live", include_in_schema=False)
    def live() -> dict[str, str]:
        return {"service": "vonk-catalog-api", "status": "live"}

    @app.get("/health/ready", include_in_schema=False, response_model=None)
    def ready() -> dict[str, str] | JSONResponse:
        try:
            readiness_probe()
        except Exception:
            return JSONResponse(
                status_code=503,
                media_type="application/problem+json",
                content={
                    "type": (
                        "https://api.vonkforge.ai/problems/"
                        "catalog.database_unavailable"
                    ),
                    "title": "Catalog database unavailable",
                    "status": 503,
                    "code": "catalog.database_unavailable",
                    "detail": "The catalog database is not ready.",
                },
            )
        return {"service": "vonk-catalog-api", "status": "ready"}

    app.include_router(build_public_router(database_sessions))
    return app
