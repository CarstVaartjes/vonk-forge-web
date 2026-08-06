from pydantic import Field
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

