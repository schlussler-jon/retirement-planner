"""
Health check endpoint.

Provides API health status and basic system information.
"""

from fastapi import APIRouter
from datetime import datetime
import sys

router = APIRouter()


@router.get("/health")
async def health_check():
    """
    Check API health status.
    
    Returns:
        Health status information including:
        - status: "healthy" or "unhealthy"
        - timestamp: Current server time
        - version: Python version
    """
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "api_version": "1.0.0"
    }


@router.get("/health/ready")
async def readiness_check():
    """
    Check if API is ready to accept requests.
    
    This can be extended to check database connections, etc.
    
    Returns:
        Readiness status
    """
    return {
        "ready": True,
        "timestamp": datetime.utcnow().isoformat()
    }
