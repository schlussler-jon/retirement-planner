"""
Google OAuth configuration and settings.

This module handles OAuth 2.0 configuration for Google authentication.
"""

import os
from pydantic_settings import BaseSettings
from typing import Optional


def _get_session_secret() -> str:
    """
    Load the session secret key, with a hard failure in production if it's
    not set. A weak or default session secret allows session cookies to be
    forged, bypassing authentication entirely.
    """
    key = os.environ.get("SESSION_SECRET_KEY", "").strip()
    is_production = os.environ.get("ENVIRONMENT", "development").lower() == "production"

    if not key:
        if is_production:
            raise RuntimeError(
                "SESSION_SECRET_KEY is not set. "
                "This environment variable is required in production. "
                "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
                " and add it to your Railway environment variables."
            )
        # Development fallback — acceptable locally, never in production
        return "development-secret-key-change-in-production"

    return key


class OAuthSettings(BaseSettings):
    """
    Google OAuth settings.

    These should be set via environment variables or .env file.
    """

    # Google OAuth Client Configuration
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/auth/callback"
    frontend_url: str = "http://localhost:3000"
    openai_api_key: str = ""

    # OAuth Scopes — request only what the app actually uses.
    # drive.file has been removed: the app stores scenarios in PostgreSQL,
    # not Google Drive. Requesting unnecessary scopes erodes user trust
    # and expands the blast radius if the OAuth token is compromised.
    google_scopes: list = [
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
    ]

    # Session Configuration
    session_secret_key: str = _get_session_secret()
    session_cookie_name: str = "retirement_planner_session"
    session_max_age: int = 86400  # 24 hours

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Global settings instance
oauth_settings = OAuthSettings()


def get_oauth_settings() -> OAuthSettings:
    """Get OAuth settings instance."""
    return oauth_settings
