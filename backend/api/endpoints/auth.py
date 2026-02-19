"""
Authentication endpoints.

Handles Google OAuth login/logout flow with token exchange.
"""

from fastapi import APIRouter, Request, HTTPException, Response
from fastapi.responses import RedirectResponse, JSONResponse
from typing import Optional
import logging
import time
import secrets

from auth.oauth import get_google_oauth, GoogleUser
from auth.session import create_session, get_user_from_session, delete_session
from auth.config import get_oauth_settings

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_oauth_settings()

# Token store for one-time exchange tokens
_token_store = {}


@router.get("/login")
async def login(request: Request):
    """
    Initiate Google OAuth login flow.
    
    Redirects user to Google's OAuth consent screen.
    """
    logger.info(f"Login initiated, cookies in request: {request.cookies}")

    if not settings.google_client_id:
        raise HTTPException(
            status_code=503,
            detail="OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
        )
    
    google = get_google_oauth()
    redirect_uri = settings.google_redirect_uri
    
    return await google.authorize_redirect(request, redirect_uri)


@router.get("/callback")
async def auth_callback(request: Request):
    """
    OAuth callback endpoint.
    
    Google redirects here after user authorizes the app.
    """
    logger.info(f"Callback received, cookies in request: {request.cookies}")
    logger.info(f"Callback query params: {request.query_params}")
    try:
        google = get_google_oauth()
        
        # Exchange authorization code for access token
        token = await google.authorize_access_token(request)
        
        # Get user info from Google
        user_info = token.get('userinfo')
        if not user_info:
            resp = await google.get('https://www.googleapis.com/oauth2/v3/userinfo', token=token)
            user_info = resp.json()
        
        # Create user object
        user = GoogleUser(user_info)
        
        # Create session
        session_id = create_session(user, token.get('access_token'))
        
        # Generate one-time token for frontend exchange
        exchange_token = secrets.token_urlsafe(32)
        
        # Store token temporarily (5 min expiry)
        _token_store[exchange_token] = {
            'session_id': session_id,
            'expires': time.time() + 300  # 5 minutes
        }
        
        # Clean up expired tokens
        current_time = time.time()
        expired_tokens = [t for t, data in _token_store.items() if data['expires'] < current_time]
        for t in expired_tokens:
            del _token_store[t]
        
        # Redirect to frontend with token
        frontend_url = settings.frontend_url
        redirect_url = f"{frontend_url}?token={exchange_token}"
        logger.info(f"User logged in: {user.email}, redirecting with exchange token")
        
        return RedirectResponse(url=redirect_url)
        
    except Exception as e:
        logger.error(f"OAuth callback error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Authentication failed: {str(e)}")


@router.post("/exchange")
async def exchange_token(request: Request, response: Response):
    """
    Exchange one-time token for session cookie.
    
    Frontend calls this after OAuth redirect with token from URL.
    """
    body = await request.json()
    token = body.get('token')
    
    if not token:
        raise HTTPException(status_code=400, detail="Token required")
    
    token_data = _token_store.get(token)
    
    if not token_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    # Check expiry
    if time.time() > token_data['expires']:
        del _token_store[token]
        raise HTTPException(status_code=401, detail="Token expired")
    
    # Get session ID
    session_id = token_data['session_id']
    
    # Delete token (one-time use)
    del _token_store[token]
    
    # Set session cookie (now same-origin request, works!)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=session_id,
        max_age=settings.session_max_age,
        domain=".my-moneyplan.com",
        httponly=True,
        secure=True,
        samesite='none'
    )
    
    logger.info("Token exchanged successfully, session cookie set")
    
    return {"success": True}


@router.post("/logout")
async def logout(request: Request, response: Response):
    """
    Log out the current user.
    
    Deletes the session and clears the cookie.
    """
    session_id = request.cookies.get(settings.session_cookie_name)
    
    if session_id:
        delete_session(session_id)
    
    response.delete_cookie(
        key=settings.session_cookie_name,
        domain=".my-moneyplan.com"
    )
    
    return {"message": "Logged out successfully"}


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