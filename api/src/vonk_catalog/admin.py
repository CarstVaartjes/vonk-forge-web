import argparse

from .db import build_engine, database_url_with_password, session_factory
from .publishers import seed_official_publisher
from .settings import Settings


def main() -> None:
    parser = argparse.ArgumentParser(prog="vonk-catalog-admin")
    parser.add_argument("command", choices=("seed-official",))
    arguments = parser.parse_args()
    settings = Settings()
    if arguments.command == "seed-official":
        if not settings.founder_oauth_provider or not settings.founder_oauth_subject:
            parser.error(
                "VONK_FOUNDER_OAUTH_PROVIDER and VONK_FOUNDER_OAUTH_SUBJECT are required"
            )
        engine = build_engine(
            database_url_with_password(
                settings.database_url, settings.database_password_file
            )
        )
        try:
            with session_factory(engine).begin() as database:
                publisher = seed_official_publisher(
                    database,
                    settings.founder_oauth_provider,
                    settings.founder_oauth_subject,
                )
                print(f"official publisher ready: {publisher.slug} ({publisher.id})")
        finally:
            engine.dispose()


if __name__ == "__main__":
    main()
