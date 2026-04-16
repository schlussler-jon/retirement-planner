"""
Main FastAPI application.

This is the REST API that wraps the retirement planning calculation engine.
"""
from dotenv import load_dotenv
load_dotenv()  # Load .env file

import os

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from typing import Dict, Any
import logging

from .endpoints import projections, health, auth, drive, analysis, montecarlo, roth_strategy, financial_feed
from .endpoints import scenarios_db as scenarios  # PostgreSQL-backed scenarios
from .endpoints import starter_scenario
from auth.oauth import configure_oauth
from auth.config import get_oauth_settings
from starlette.middleware.sessions import SessionMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ── Rate limiter (shared instance imported by endpoints) ──────────────────
limiter = Limiter(key_func=get_remote_address)

# ── Detect environment ────────────────────────────────────────────────────
IS_PRODUCTION = os.getenv("ENVIRONMENT", "development").lower() == "production"

# ── Create FastAPI app ────────────────────────────────────────────────────
# Swagger UI and ReDoc are disabled in production — they expose all endpoint
# schemas and provide an interactive console anyone on the internet can use.
app = FastAPI(
    title="Retirement Planning API",
    description="REST API for comprehensive retirement planning calculations",
    version="1.0.0",
    docs_url=None if IS_PRODUCTION else "/api/docs",
    redoc_url=None if IS_PRODUCTION else "/api/redoc",
    openapi_url=None if IS_PRODUCTION else "/api/openapi.json",
)

# Attach rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────────────────
# Explicitly enumerate allowed origins, methods, and headers.
# Never use allow_origins=["*"] with allow_credentials=True.
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://www.my-moneyplan.com",
]
if frontend_url and frontend_url not in allowed_origins:
    allowed_origins.append(frontend_url)

logging.info(f"CORS allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

# ── Session middleware for OAuth state ────────────────────────────────────
app.add_middleware(
    SessionMiddleware,
    secret_key=get_oauth_settings().session_secret_key,
    same_site='none',
    https_only=True
)

# ── CSRF protection middleware ────────────────────────────────────────────
# For state-changing requests (POST, PUT, DELETE, PATCH), verify the Origin
# header is one of our known frontends.  This stops cross-site forgery even
# though cookies use SameSite=None (required for cross-subdomain auth).
# GET and HEAD are safe methods and are not checked.
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

@app.middleware("http")
async def csrf_origin_check(request: Request, call_next):
    if request.method not in SAFE_METHODS:
        origin = request.headers.get("origin") or request.headers.get("referer", "")
        if not any(origin.startswith(o) for o in allowed_origins):
            logger.warning(f"CSRF check failed — Origin: {origin!r}, method: {request.method}")
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Forbidden"},
            )
    return await call_next(request)


# ── Routers ───────────────────────────────────────────────────────────────
app.include_router(health.router,          prefix="/api",       tags=["Health"])
app.include_router(auth.router,            prefix="/api/auth",  tags=["Authentication"])
app.include_router(starter_scenario.router,  prefix="/api", tags=["Starter"])  
app.include_router(scenarios.router,       prefix="/api",       tags=["Scenarios"])
app.include_router(projections.router,     prefix="/api",       tags=["Projections"])
app.include_router(drive.router,           prefix="/api/drive", tags=["Google Drive"])
app.include_router(analysis.router,        prefix="/api",       tags=["Analysis"])
app.include_router(montecarlo.router,      prefix="/api",       tags=["Monte Carlo"])
app.include_router(roth_strategy.router,   prefix="/api",       tags=["Roth Strategy"])
app.include_router(financial_feed.router,  prefix="/api",       tags=["Financial Feed"])


@app.on_event("startup")
async def startup_event():
    """Configure OAuth on startup."""
    configure_oauth()
    env_label = "PRODUCTION" if IS_PRODUCTION else "DEVELOPMENT"
    logger.info(f"Application started successfully [{env_label}]")
    if IS_PRODUCTION:
        logger.info("API docs disabled (production mode)")


# ── Error handlers ────────────────────────────────────────────────────────

@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    """Handle validation errors."""
    logger.error(f"Validation error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": str(exc)}
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle unexpected errors without leaking internals."""
    logger.error(f"Unexpected error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred. Please try again."}
    )


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Retirement Planning API",
        "version": "1.0.0",
    }
