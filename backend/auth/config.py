"""
Google OAuth configuration and settings.

This module handles OAuth 2.0 configuration for Google authentication.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class OAuthSettings(BaseSettings):
    """
    Google OAuth settings.
    
    These should be set via environment variables or .env file.
    """
    
    # Google OAuth Client Configuration
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/auth/callback"
    frontend_url: str = "http://localhost:3000"  # Frontend URL for OAuth redirects
    openai_api_key: str = ""  # Add this line

    
    # OAuth Scopes
    google_scopes: list = [
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/drive.file",  # Access to files created by this app
    ]
    
    # Session Configuration
    session_secret_key: str = "development-secret-key-change-in-production"
    session_cookie_name: str = "retirement_planner_session"
    session_max_age: int = 86400  # 24 hours
    
    # Drive Configuration
    drive_folder_name: str = "Retirement Planner Scenarios"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Global settings instance
oauth_settings = OAuthSettings()


def get_oauth_settings() -> OAuthSettings:
    """Get OAuth settings instance."""
    return oauth_settings
