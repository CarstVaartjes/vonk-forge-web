from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from vonk_catalog.models import (
    OAuthAccount,
    PublisherAuditEvent,
    PublisherMembership,
    User,
)
from vonk_catalog.problems import Problem
from vonk_catalog.publishers import PublisherService, seed_official_publisher


def _user(session, name: str, subject: str, email: str) -> User:
    user = User(display_name=name)
    session.add(user)
    session.flush()
    session.add(
        OAuthAccount(
            user_id=user.id,
            provider="github",
            subject=subject,
            email=email,
        )
    )
    session.flush()
    return user


def test_claim_namespace_normalizes_and_reserves_official_lookalikes(session) -> None:
    owner = _user(session, "Ada", "gh-1", "ada@example.test")
    service = PublisherService(session)
    publisher = service.create(owner.id, "  Ada-Labs  ", "Ada Labs")
    session.commit()

    assert publisher.slug == "ada-labs"
    membership = session.get(PublisherMembership, (publisher.id, owner.id))
    assert membership is not None and membership.role == "owner"
    assert session.scalar(select(PublisherAuditEvent)) is not None

    for reserved in ("vonk", "VONK-FORGE", "official", "git-hub", "google"):
        with pytest.raises(Problem) as error:
            service.create(owner.id, reserved, "Reserved")
        assert error.value.code == "publisher.slug_reserved"
        session.rollback()


def test_roles_invitation_last_owner_and_cross_publisher_denial(session) -> None:
    owner = _user(session, "Owner", "gh-owner", "owner@example.test")
    editor = _user(session, "Editor", "gh-editor", "editor@example.test")
    outsider = _user(session, "Outsider", "gh-other", "other@example.test")
    service = PublisherService(session, clock=lambda: datetime(2026, 8, 7, tzinfo=UTC))
    publisher = service.create(owner.id, "ember-lab", "Ember Lab")
    other = service.create(outsider.id, "other-lab", "Other Lab")

    invitation = service.invite(
        owner.id, publisher.slug, "EDITOR@example.test", "editor"
    )
    service.accept_invitation(editor.id, invitation.token)
    session.flush()
    assert service.require_role(editor.id, publisher.slug, "editor").id == publisher.id

    with pytest.raises(Problem) as denied:
        service.require_role(outsider.id, publisher.slug, "viewer")
    assert denied.value.code == "publisher.access_denied"

    with pytest.raises(Problem):
        service.invite(editor.id, other.slug, "nobody@example.test", "viewer")

    with pytest.raises(Problem) as last_owner:
        service.change_role(owner.id, publisher.slug, owner.id, "viewer")
    assert last_owner.value.code == "publisher.last_owner"

    service.change_role(owner.id, publisher.slug, editor.id, "owner")
    service.remove_member(editor.id, publisher.slug, owner.id)
    session.commit()
    assert session.get(PublisherMembership, (publisher.id, owner.id)) is None
    assert len(list(session.scalars(select(PublisherAuditEvent)))) >= 6


def test_invitation_requires_matching_verified_oauth_email_and_expiry(session) -> None:
    now = datetime(2026, 8, 7, tzinfo=UTC)
    owner = _user(session, "Owner", "gh-owner-2", "owner2@example.test")
    invited = _user(session, "Invited", "gh-invited", "wrong@example.test")
    service = PublisherService(session, clock=lambda: now)
    publisher = service.create(owner.id, "torch-lab", "Torch Lab")
    invitation = service.invite(
        owner.id, publisher.slug, "right@example.test", "viewer"
    )

    with pytest.raises(Problem) as mismatch:
        service.accept_invitation(invited.id, invitation.token)
    assert mismatch.value.code == "publisher.invitation_identity_mismatch"

    invited_account = session.scalar(
        select(OAuthAccount).where(OAuthAccount.user_id == invited.id)
    )
    assert invited_account is not None
    invited_account.email = "right@example.test"
    invitation_row = service.invitation_by_token(invitation.token)
    invitation_row.expires_at = now - timedelta(seconds=1)
    with pytest.raises(Problem) as expired:
        service.accept_invitation(invited.id, invitation.token)
    assert expired.value.code == "publisher.invitation_expired"


def test_official_publisher_seed_is_idempotent_and_not_claimable(session) -> None:
    founder = _user(session, "Founder", "founder-subject", "founder@example.test")
    first = seed_official_publisher(session, "github", "founder-subject")
    second = seed_official_publisher(session, "github", "founder-subject")
    session.commit()

    assert first.id == second.id
    assert first.slug == "vonk" and first.system_role == "official"
    membership = session.get(PublisherMembership, (first.id, founder.id))
    assert membership is not None and membership.role == "owner"
