"""
Authentication endpoints.

Handles Google OAuth login/logout flow.
"""

from fastapi import APIRouter, Request, HTTPException, Response
from fastapi.responses import RedirectResponse, JSONResponse
from typing import Optional
import logging

from auth.oauth import get_google_oauth, GoogleUser, configure_oauth
from auth.session import create_session, get_user_from_session, delete_session
from auth.config import get_oauth_settings

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_oauth_settings()


@router.get("/login")
async def login(request: Request):
    """
    Initiate Google OAuth login flow.
    
    Redirects user to Google's OAuth consent screen.
    """
    if not settings.google_client_id:
        raise HTTPException(
            status_code=503,
            detail="OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
        )
    
    google = get_google_oauth()
    redirect_uri = settings.google_redirect_uri
    
    return await google.authorize_redirect(request, redirect_uri)


@router.get("/callback")
async def auth_callback(request: Request, response: Response):
    """
    OAuth callback endpoint.
    
    Google redirects here after user authorizes the app.
    """
    try:
        google = get_google_oauth()
        
        # Exchange authorization code for access token
        token = await google.authorize_access_token(request)
        
        # Get user info
        user_info = token.get('userinfo')
        if not user_info:
            # Fetch user info if not in token
            user_info = await google.userinfo(token=token)
        
        # Create user object
        user = GoogleUser(user_info)
        
        # Create session
        session_id = create_session(user, token['access_token'])
        
        # Set session cookie
        response = RedirectResponse(url="http://localhost:3000/")
        response.set_cookie(
            key=settings.session_cookie_name,
            value=session_id,
            max_age=settings.session_max_age,
            httponly=True,
            samesite='lax'
        )
        
        logger.info(f"User logged in: {user.email}")
        
        return response
        
    except Exception as e:
        logger.error(f"OAuth callback error: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail="Authentication failed")


@router.post("/logout")
async def logout(request: Request, response: Response):
    """
    Logout current user.
    
    Clears session cookie and removes session data.
    """
    # Get session ID from cookie
    session_id = request.cookies.get(settings.session_cookie_name)
    
    if session_id:
        # Delete session
        delete_session(session_id)
        
        logger.info("User logged out")
    
    # Clear cookie
    response = JSONResponse(content={"message": "Logged out successfully"})
    response.delete_cookie(settings.session_cookie_name)
    
    return response


@router.get("/me")
async def get_current_user(request: Request):
    """
    Get current authenticated user.
    
    Returns user information if logged in.
    """
    # Get session ID from cookie
    session_id = request.cookies.get(settings.session_cookie_name)
    
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get user from session
    user = get_user_from_session(session_id)
    
    if not user:
        raise HTTPException(status_code=401, detail="Session expired")
    
    return user.to_dict()


@router.get("/status")
async def auth_status(request: Request):
    """
    Check authentication status.
    
    Returns whether user is logged in and basic info.
    """
    session_id = request.cookies.get(settings.session_cookie_name)
    
    if not session_id:
        return {
            "authenticated": False,
            "user": None
        }
    
    user = get_user_from_session(session_id)
    
    if not user:
        return {
            "authenticated": False,
            "user": None
        }
    
    return {
        "authenticated": True,
        "user": {
            "email": user.email,
            "name": user.name,
            "picture": user.picture
        }
    }
