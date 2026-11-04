from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", protected_namespaces=("settings_",))

    app_name: str = Field(default="Kronos Web API")
    environment: str = Field(default="development")
    debug: bool = Field(default=True)
    database_url: str = Field(default="sqlite:///./app.db")
    secret_key: str = Field(default="change-me")
    jwt_algorithm: str = Field(default="HS256")
    default_username: str = Field(default="admin")
    default_password: str = Field(default="admin123")
    model_name: str = Field(default="NeoQuasar/Kronos-small")
    tokenizer_name: str = Field(default="NeoQuasar/Kronos-Tokenizer-base")
    allowed_origins: str = Field(default="http://localhost:5173")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
