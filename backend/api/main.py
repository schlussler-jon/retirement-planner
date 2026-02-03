"""
Main FastAPI application.

This is the REST API that wraps the retirement planning calculation engine.
"""

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Dict, Any
import logging

from .endpoints import scenarios, projections, health, auth, drive
from auth.oauth import configure_oauth
from auth.config import get_oauth_settings
from starlette.middleware.sessions import SessionMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Retirement Planning API",
    description="REST API for comprehensive retirement planning calculations",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# Configure CORS
import os

# Get frontend URL from environment, fallback to localhost for dev
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
]
# Add production frontend URL if it's set and different from localhost
if frontend_url and not frontend_url.startswith("http://localhost"):
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(SessionMiddleware, secret_key=get_oauth_settings().session_secret_key)

# Include routers
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(scenarios.router, prefix="/api", tags=["Scenarios"])
app.include_router(projections.router, prefix="/api", tags=["Projections"])
app.include_router(drive.router, prefix="/api/drive", tags=["Google Drive"])


@app.on_event("startup")
async def startup_event():
    """Configure OAuth on startup."""
    configure_oauth()
    logger.info("Application started successfully")


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
    """Handle unexpected errors."""
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
        "docs": "/api/docs"
    }
