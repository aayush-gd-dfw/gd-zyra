from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://zyrauser:zyrapass@db:5432/zyradb"
    secret_key: str = "change-me-in-production-32chars!!"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480  # 8 hours

    # Microsoft Graph
    azure_tenant_id: str = ""
    azure_client_id: str = ""
    azure_client_secret: str = ""
    outlook_user_email: str = ""
    outlook_folder_name: str = "Zyra"
    outlook_folder_id: str = ""
    poll_interval_seconds: int = 60

    # Teams 1:1 DM notifications
    # Azure AD object ID of the "from" account for outbound DMs (e.g. admin user object ID)
    ms_sender_user_id: str = ""

    # Gemini AI
    gemini_api_key: str = ""

    # Microsoft Teams webhook (channel)
    teams_webhook_url: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"

@lru_cache
def get_settings() -> Settings:
    return Settings()
