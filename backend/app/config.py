from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/govgrants"
    redis_url: str = "redis://localhost:6379/0"
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_service_key: str = ""
    openai_api_key: str = ""
    resend_api_key: str = ""
    admin_email: str = ""

    bizinfo_api_key: str = ""
    kocca_api_key: str = ""
    kstartup_api_key: str = ""
    subsidy24_api_key: str = ""
    smes_api_key: str = ""

    model_config = {"env_file": ".env"}

    @property
    def async_database_url(self) -> str:
        """Ensure database URL uses asyncpg driver."""
        url = self.database_url
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url


settings = Settings()
