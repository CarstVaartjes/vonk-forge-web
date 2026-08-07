from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import select

from .auth import AuthServices, require_csrf, require_session
from .models import Publisher, PublisherMembership, User
from .publishers import PublisherService


class PublisherInput(BaseModel):
    slug: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=160)


class InvitationInput(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    role: Literal["owner", "editor", "viewer"]


class InvitationAcceptance(BaseModel):
    token: str = Field(min_length=43, max_length=128)


class RoleInput(BaseModel):
    role: Literal["owner", "editor", "viewer"]


def build_publisher_router(services: AuthServices) -> APIRouter:
    router = APIRouter(prefix="/v1")

    @router.get("/publishers")
    def list_publishers(request: Request) -> dict[str, object]:
        authenticated = require_session(request, services)
        with services.database_sessions() as database:
            rows = database.execute(
                select(Publisher, PublisherMembership.role)
                .join(PublisherMembership)
                .where(PublisherMembership.user_id == authenticated.user.id)
                .order_by(Publisher.slug)
            ).all()
            return {
                "items": [
                    {
                        "id": publisher.id,
                        "slug": publisher.slug,
                        "name": publisher.name,
                        "role": role,
                        "official": publisher.system_role == "official",
                    }
                    for publisher, role in rows
                ]
            }

    @router.post("/publishers", status_code=201)
    def create_publisher(body: PublisherInput, request: Request) -> dict[str, object]:
        authenticated = require_session(request, services)
        require_csrf(request, services)
        with services.database_sessions.begin() as database:
            publisher = PublisherService(database).create(
                authenticated.user.id, body.slug, body.name
            )
            return {
                "id": publisher.id,
                "slug": publisher.slug,
                "name": publisher.name,
                "role": "owner",
                "official": False,
            }

    @router.get("/publishers/{slug}/members")
    def members(slug: str, request: Request) -> dict[str, object]:
        authenticated = require_session(request, services)
        with services.database_sessions() as database:
            publisher = PublisherService(database).require_role(
                authenticated.user.id, slug, "viewer"
            )
            rows = database.execute(
                select(User, PublisherMembership.role)
                .join(PublisherMembership)
                .where(PublisherMembership.publisher_id == publisher.id)
                .order_by(User.display_name, User.id)
            ).all()
            return {
                "items": [
                    {
                        "user_id": user.id,
                        "display_name": user.display_name,
                        "role": role,
                    }
                    for user, role in rows
                ]
            }

    @router.post("/publishers/{slug}/invitations", status_code=201)
    def invite(slug: str, body: InvitationInput, request: Request) -> dict[str, object]:
        authenticated = require_session(request, services)
        require_csrf(request, services)
        with services.database_sessions.begin() as database:
            created = PublisherService(database).invite(
                authenticated.user.id, slug, body.email, body.role
            )
            return {
                "id": created.id,
                "token": created.token,
                "expires_at": created.expires_at.isoformat(),
            }

    @router.post("/publisher-invitations/accept")
    def accept(body: InvitationAcceptance, request: Request) -> dict[str, object]:
        authenticated = require_session(request, services)
        require_csrf(request, services)
        with services.database_sessions.begin() as database:
            membership = PublisherService(database).accept_invitation(
                authenticated.user.id, body.token
            )
            publisher = database.get(Publisher, membership.publisher_id)
            return {"publisher": publisher.slug, "role": membership.role}

    @router.patch("/publishers/{slug}/members/{user_id}")
    def change_role(
        slug: str, user_id: str, body: RoleInput, request: Request
    ) -> dict[str, str]:
        authenticated = require_session(request, services)
        require_csrf(request, services)
        with services.database_sessions.begin() as database:
            PublisherService(database).change_role(
                authenticated.user.id, slug, user_id, body.role
            )
        return {"role": body.role}

    @router.delete("/publishers/{slug}/members/{user_id}", status_code=204)
    def remove_member(slug: str, user_id: str, request: Request) -> Response:
        authenticated = require_session(request, services)
        require_csrf(request, services)
        with services.database_sessions.begin() as database:
            PublisherService(database).remove_member(
                authenticated.user.id, slug, user_id
            )
        return Response(status_code=204)

    return router
