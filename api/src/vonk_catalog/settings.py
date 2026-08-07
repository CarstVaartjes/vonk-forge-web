from pathlib import Path

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="VONK_",
        env_file=None,
        extra="forbid",
    )

    database_url: str = Field(
        default="postgresql+psycopg://vonk:vonk@127.0.0.1:5432/vonk_catalog"
    )
    database_password_file: Path | None = None
    production: bool = False
    public_base_url: str = "http://127.0.0.1:8000"
    session_secret: SecretStr = SecretStr("development-only-session-secret-do-not-use")
    session_ttl_seconds: int = Field(default=2_592_000, ge=300, le=31_536_000)
    oauth_flow_ttl_seconds: int = Field(default=600, ge=60, le=900)
    github_client_id: str | None = None
    github_client_secret: SecretStr | None = None
    google_client_id: str | None = None
    google_client_secret: SecretStr | None = None

    @model_validator(mode="after")
    def secure_production(self) -> "Settings":
        if self.production:
            if not self.public_base_url.startswith("https://"):
                raise ValueError("production public base URL must use HTTPS")
            if len(self.session_secret.get_secret_value()) < 32:
                raise ValueError("production session secret is too short")
        for provider in ("github", "google"):
            client_id = getattr(self, f"{provider}_client_id")
            client_secret = getattr(self, f"{provider}_client_secret")
            if (client_id is None) != (client_secret is None):
                raise ValueError(f"{provider} OAuth configuration is incomplete")
        return self
