from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from vonk_catalog.api import create_app
from vonk_catalog.models import User
from vonk_catalog.session import SessionService
from vonk_catalog.settings import Settings


def test_publisher_routes_require_session_and_csrf(engine) -> None:
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    settings = Settings(session_secret="p" * 64)
    with sessions.begin() as database:
        user = User(display_name="Ada")
        database.add(user)
        database.flush()
        user_id = user.id
    app = create_app(database_sessions=sessions, settings=settings)
    with TestClient(app) as client:
        assert (
            client.post(
                "/v1/publishers", json={"slug": "ada", "name": "Ada"}
            ).status_code
            == 401
        )

        created = SessionService(sessions, b"p" * 64).create(user_id, "testclient", "")
        client.cookies.set("vonk_session", created.token)
        assert (
            client.post(
                "/v1/publishers", json={"slug": "ada", "name": "Ada"}
            ).status_code
            == 403
        )
        response = client.post(
            "/v1/publishers",
            json={"slug": "ada", "name": "Ada"},
            headers={"X-CSRF-Token": created.csrf_token},
        )
        assert response.status_code == 201
        assert response.json()["role"] == "owner"
        assert client.get("/v1/publishers").json()["items"][0]["slug"] == "ada"
