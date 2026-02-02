"""
Google OAuth client.

Handles OAuth 2.0 flow for Google authentication.
"""

from authlib.integrations.starlette_client import OAuth
from starlette.config import Config
from typing import Optional, Dict, Any
import logging

from .config import get_oauth_settings

logger = logging.getLogger(__name__)

# OAuth configuration
settings = get_oauth_settings()

# Create OAuth instance
oauth = OAuth()


def configure_oauth() -> None:
    """
    Configure OAuth with Google.
    
    This should be called during app startup.
    """
    if not settings.google_client_id or not settings.google_client_secret:
        logger.warning(
            "Google OAuth credentials not configured. "
            "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables."
        )
        return
    
    oauth.register(
        name='google',
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={
            'scope': ' '.join(settings.google_scopes)
        }
    )
    
    logger.info("Google OAuth configured successfully")


def get_google_oauth():
    """Get Google OAuth client."""
    return oauth.google


class GoogleUser:
    """
    Google user information.
    
    Extracted from OAuth token.
    """
    
    def __init__(self, user_info: Dict[str, Any]):
        """
        Initialize from OAuth user info.
        
        Args:
            user_info: User info from Google OAuth
        """
        self.id: str = user_info.get('sub', '')
        self.email: str = user_info.get('email', '')
        self.name: str = user_info.get('name', '')
        self.picture: Optional[str] = user_info.get('picture')
        self.email_verified: bool = user_info.get('email_verified', False)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'picture': self.picture,
            'email_verified': self.email_verified
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'GoogleUser':
        """Create from dictionary."""
        return cls(data)
