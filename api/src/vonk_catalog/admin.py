import argparse

from sqlalchemy import select

from .db import build_engine, database_url_with_password, session_factory
from .models import OAuthAccount, User
from .publishers import seed_official_publisher
from .settings import Settings


def main() -> None:
    parser = argparse.ArgumentParser(prog="vonk-catalog-admin")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("seed-official")
    role = commands.add_parser("set-system-role")
    role.add_argument("--provider", choices=("github", "google"), required=True)
    role.add_argument("--subject", required=True)
    role.add_argument("--role", choices=("admin", "moderator", "none"), required=True)
    arguments = parser.parse_args()
    settings = Settings()
    engine = build_engine(
        database_url_with_password(
            settings.database_url, settings.database_password_file
        )
    )
    try:
        if arguments.command == "seed-official":
            if (
                not settings.founder_oauth_provider
                or not settings.founder_oauth_subject
            ):
                parser.error(
                    "VONK_FOUNDER_OAUTH_PROVIDER and VONK_FOUNDER_OAUTH_SUBJECT are required"
                )
            with session_factory(engine).begin() as database:
                publisher = seed_official_publisher(
                    database,
                    settings.founder_oauth_provider,
                    settings.founder_oauth_subject,
                )
                print(f"official publisher ready: {publisher.slug} ({publisher.id})")
        elif arguments.command == "set-system-role":
            with session_factory(engine).begin() as database:
                account = database.scalar(
                    select(OAuthAccount).where(
                        OAuthAccount.provider == arguments.provider,
                        OAuthAccount.subject == arguments.subject,
                    )
                )
                if account is None:
                    parser.error(
                        "the OAuth identity must sign in before assigning a role"
                    )
                user = database.get(User, account.user_id)
                if user is None:
                    parser.error("OAuth account has no user")
                user.system_role = None if arguments.role == "none" else arguments.role
                print(f"system role updated for user {user.id}")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
