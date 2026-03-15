from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/govgrants"
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_service_key: str = ""
    openai_api_key: str = ""
    voyage_api_key: str = ""
    resend_api_key: str = ""
    admin_email: str = ""

    bizinfo_api_key: str = ""
    kocca_api_key: str = ""
    kstartup_api_key: str = ""
    subsidy24_api_key: str = ""
    smes_api_key: str = ""

    # Neo4j Aura
    neo4j_uri: str = ""           # e.g. neo4j+s://xxxx.databases.neo4j.io
    neo4j_username: str = "neo4j"
    neo4j_password: str = ""

    model_config = {"env_file": ".env"}

    @property
    def async_database_url(self) -> str:
        url = self.database_url
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url


settings = Settings()
