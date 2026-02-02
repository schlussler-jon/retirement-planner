"""
Redis-backed session storage.

Replaces in-memory dict for production - sessions persist across restarts
and work correctly with multiple backend instances.
"""

from typing import Optional, Dict, Any
import secrets
import time
import json
import os
from .oauth import GoogleUser
from .config import get_oauth_settings

settings = get_oauth_settings()

# Redis client (lazy-initialized)
_redis_client = None


def get_redis_client():
    """
    Get Redis client, creating it if needed.
    
    Falls back to in-memory dict if Redis is unavailable (dev mode).
    """
    global _redis_client
    
    if _redis_client is not None:
        return _redis_client
    
    redis_url = os.getenv("REDIS_URL")
    
    if not redis_url:
        # Development mode - use in-memory fallback
        print("WARNING: REDIS_URL not set, using in-memory sessions (dev only)")
        _redis_client = InMemorySessionStore()
        return _redis_client
    
    try:
        import redis
        _redis_client = redis.from_url(redis_url, decode_responses=True)
        # Test connection
        _redis_client.ping()
        print(f"✓ Connected to Redis at {redis_url.split('@')[-1]}")
    except Exception as e:
        print(f"WARNING: Redis connection failed ({e}), falling back to in-memory sessions")
        _redis_client = InMemorySessionStore()
    
    return _redis_client


class InMemorySessionStore:
    """Fallback in-memory session store for development."""
    
    def __init__(self):
        self.store: Dict[str, str] = {}
    
    def setex(self, key: str, ttl: int, value: str):
        """Set key with expiry."""
        self.store[key] = value
    
    def get(self, key: str) -> Optional[str]:
        """Get key value."""
        return self.store.get(key)
    
    def delete(self, key: str):
        """Delete key."""
        self.store.pop(key, None)
    
    def ping(self):
        """Health check."""
        return True


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
    redis = get_redis_client()
    
    session_data = {
        'user': user.to_dict(),
        'access_token': access_token,
        'created_at': time.time(),
        'expires_at': time.time() + settings.session_max_age
    }
    
    # Store in Redis with TTL
    redis.setex(
        f"session:{session_id}",
        settings.session_max_age,
        json.dumps(session_data)
    )
    
    return session_id


def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    """
    Get session data by ID.
    
    Args:
        session_id: Session identifier
        
    Returns:
        Session data if valid, None if expired or not found
    """
    redis = get_redis_client()
    data = redis.get(f"session:{session_id}")
    
    if not data:
        return None
    
    try:
        session = json.loads(data)
    except json.JSONDecodeError:
        return None
    
    # Check if expired (redundant with Redis TTL, but defensive)
    if time.time() > session['expires_at']:
        redis.delete(f"session:{session_id}")
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
    redis = get_redis_client()
    result = redis.delete(f"session:{session_id}")
    return result > 0


def cleanup_expired_sessions() -> int:
    """
    Remove all expired sessions.
    
    With Redis, TTL handles this automatically - this is a no-op.
    Kept for API compatibility.
    
    Returns:
        0 (Redis handles expiry automatically)
    """
    return 0
