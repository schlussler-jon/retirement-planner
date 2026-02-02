"""
Session management for user authentication.

Handles storing and retrieving user sessions.
"""

from typing import Optional, Dict, Any
import secrets
import time
from .oauth import GoogleUser
from .config import get_oauth_settings

settings = get_oauth_settings()

# In-memory session store (Phase 7 will add Redis/database)
sessions: Dict[str, Dict[str, Any]] = {}


def create_session(user: GoogleUser, access_token: str) -> str:
    """
    Create a new session for a user.
    
    Args:
        user: Google user information
        access_token: OAuth access token
        
    Returns:
        Session ID
    """
    session_id = secrets.token_urlsafe(32)
    
    sessions[session_id] = {
        'user': user.to_dict(),
        'access_token': access_token,
        'created_at': time.time(),
        'expires_at': time.time() + settings.session_max_age
    }
    
    return session_id


def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    """
    Get session data by ID.
    
    Args:
        session_id: Session identifier
        
    Returns:
        Session data if valid, None if expired or not found
    """
    session = sessions.get(session_id)
    
    if not session:
        return None
    
    # Check if expired
    if time.time() > session['expires_at']:
        # Remove expired session
        del sessions[session_id]
        return None
    
    return session


def get_user_from_session(session_id: str) -> Optional[GoogleUser]:
    """
    Get user from session.
    
    Args:
        session_id: Session identifier
        
    Returns:
        GoogleUser if session is valid, None otherwise
    """
    session = get_session(session_id)
    
    if not session:
        return None
    
    return GoogleUser.from_dict(session['user'])


def delete_session(session_id: str) -> bool:
    """
    Delete a session (logout).
    
    Args:
        session_id: Session identifier
        
    Returns:
        True if session was deleted, False if not found
    """
    if session_id in sessions:
        del sessions[session_id]
        return True
    
    return False


def cleanup_expired_sessions() -> int:
    """
    Remove all expired sessions.
    
    Returns:
        Number of sessions removed
    """
    current_time = time.time()
    expired = [
        sid for sid, session in sessions.items()
        if current_time > session['expires_at']
    ]
    
    for sid in expired:
        del sessions[sid]
    
    return len(expired)
