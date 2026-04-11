from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    anthropic_api_key: str = ""
    cors_origins: str = "http://localhost:3000"
    # Hardcoded dev user ID — replace with Supabase Auth later
    dev_user_id: str = "00000000-0000-0000-0000-000000000001"

    model_config = {"env_file": ".env"}


settings = Settings()  # type: ignore[reportCallIssue]
