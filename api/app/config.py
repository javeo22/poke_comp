import os

from pydantic_settings import BaseSettings


def _resolve_supabase_url() -> str:
    """Accept both SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL."""
    return os.environ.get(
        "SUPABASE_URL",
        os.environ.get("NEXT_PUBLIC_SUPABASE_URL", ""),
    )


def _resolve_supabase_key() -> str:
    """Accept SUPABASE_SERVICE_KEY, SUPABASE_SERVICE_ROLE_KEY, or the
    Vercel integration key name."""
    return os.environ.get(
        "SUPABASE_SERVICE_KEY",
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""),
    )


class Settings(BaseSettings):
    supabase_url: str = _resolve_supabase_url()
    supabase_service_key: str = _resolve_supabase_key()
    anthropic_api_key: str = ""
    cors_origins: str = "http://localhost:3000,https://pokecomp.app"
    # Hardcoded dev user ID — replace with Supabase Auth later
    dev_user_id: str = "00000000-0000-0000-0000-000000000001"

    model_config = {"env_file": ".env"}


settings = Settings()  # type: ignore[reportCallIssue]
