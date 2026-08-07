from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import sessionmaker
from vonk_catalog.models import User
from vonk_catalog.session import SessionService


def test_sessions_store_hashes_rotate_and_reject_old_tokens(engine) -> None:
    now = datetime(2026, 8, 7, tzinfo=UTC)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    with sessions.begin() as database:
        user = User(display_name="Ada")
        database.add(user)
        database.flush()
        user_id = user.id

    service = SessionService(sessions, b"k" * 64, clock=lambda: now)
    created = service.create(user_id, "192.0.2.1", "browser")
    assert service.authenticate(created.token, "192.0.2.1", "browser") is not None

    rotated = service.rotate(created.token, user_id, "192.0.2.1", "browser")
    assert rotated.token != created.token
    assert service.authenticate(created.token, "192.0.2.1", "browser") is None
    assert service.authenticate(rotated.token, "192.0.2.1", "browser") is not None
    assert service.verify_csrf(rotated.token, rotated.csrf_token)
    assert not service.verify_csrf(rotated.token, rotated.csrf_token + "x")


def test_expired_session_is_not_authenticated(engine) -> None:
    now = datetime(2026, 8, 7, tzinfo=UTC)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    with sessions.begin() as database:
        user = User(display_name="Grace")
        database.add(user)
        database.flush()
        user_id = user.id

    clock_value = [now]
    service = SessionService(
        sessions,
        b"z" * 64,
        ttl=timedelta(minutes=5),
        clock=lambda: clock_value[0],
    )
    created = service.create(user_id, "192.0.2.2", "browser")
    clock_value[0] = now + timedelta(minutes=6)
    assert service.authenticate(created.token, "192.0.2.2", "browser") is None
