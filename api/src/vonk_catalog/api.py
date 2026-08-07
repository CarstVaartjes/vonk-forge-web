from collections.abc import Callable
from datetime import timedelta

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from .auth import AuthServices
from .auth_api import build_auth_router
from .draft_api import build_draft_router
from .moderation_api import build_moderation_router
from .oauth import HttpOAuthBackend, OAuthBackend
from .problems import install_problem_handling
from .public_api import SessionProvider, build_public_router
from .publication_api import build_publication_router
from .publisher_api import build_publisher_router
from .security import install_security
from .session import SessionService
from .settings import Settings

ReadinessProbe = Callable[[], None]


def _ready() -> None:
    """Default probe used before database wiring is configured."""


def create_app(
    readiness_probe: ReadinessProbe = _ready,
    database_sessions: SessionProvider | None = None,
    settings: Settings | None = None,
    oauth_backend: OAuthBackend | None = None,
) -> FastAPI:
    resolved_settings = settings or Settings()
    app = FastAPI(title="Vonk Forge Catalog API", version="1.0.0")
    install_problem_handling(app)
    install_security(app, resolved_settings, database_sessions)

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
                        "https://api.vonkforge.ai/problems/catalog.database_unavailable"
                    ),
                    "title": "Catalog database unavailable",
                    "status": 503,
                    "code": "catalog.database_unavailable",
                    "detail": "The catalog database is not ready.",
                },
            )
        return {"service": "vonk-catalog-api", "status": "ready"}

    app.include_router(build_public_router(database_sessions))
    if database_sessions is not None:
        auth_services = AuthServices(
            database_sessions=database_sessions,
            sessions=SessionService(
                database_sessions,
                resolved_settings.session_secret.get_secret_value().encode(),
                ttl=timedelta(seconds=resolved_settings.session_ttl_seconds),
            ),
            cookie_name=(
                "__Host-vonk_session"
                if resolved_settings.production
                else "vonk_session"
            ),
            secure_cookie=resolved_settings.production,
        )
        app.include_router(
            build_auth_router(
                auth_services,
                oauth_backend or HttpOAuthBackend.from_settings(resolved_settings),
                resolved_settings,
            )
        )
        app.include_router(build_publisher_router(auth_services))
        app.include_router(build_draft_router(auth_services))
        app.include_router(build_publication_router(auth_services))
        app.include_router(
            build_moderation_router(
                auth_services,
                resolved_settings.session_secret.get_secret_value().encode(),
            )
        )
    return app
