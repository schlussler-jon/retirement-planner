"""
Google Drive endpoints.

Handles saving and loading scenarios from Google Drive.
"""

from fastapi import APIRouter, Request, HTTPException, status
from typing import Dict, Any
import logging

from drive.client import get_drive_client
from auth.config import get_oauth_settings

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_oauth_settings()


@router.post("/scenarios/{scenario_id}/save")
async def save_to_drive(scenario_id: str, scenario_data: Dict[str, Any], request: Request):
    """
    Save scenario to Google Drive.
    
    Requires authentication.
    
    Args:
        scenario_id: Scenario identifier
        scenario_data: Complete scenario data
        request: HTTP request (for session cookie)
        
    Returns:
        Confirmation with Drive file ID
    """
    # Get session ID
    session_id = request.cookies.get(settings.session_cookie_name)
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please login first."
        )
    
    # Get Drive client
    drive_client = get_drive_client(session_id)
    if not drive_client:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session"
        )
    
    try:
        # Save to Drive
        file_id = drive_client.save_scenario(scenario_id, scenario_data)
        
        logger.info(f"Saved scenario to Drive: {scenario_id}")
        
        return {
            "scenario_id": scenario_id,
            "file_id": file_id,
            "message": "Scenario saved to Google Drive successfully"
        }
        
    except Exception as e:
        logger.error(f"Error saving to Drive: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save to Google Drive: {str(e)}"
        )


@router.get("/scenarios/{scenario_id}/load")
async def load_from_drive(scenario_id: str, request: Request):
    """
    Load scenario from Google Drive.
    
    Requires authentication.
    
    Args:
        scenario_id: Scenario identifier
        request: HTTP request (for session cookie)
        
    Returns:
        Complete scenario data
    """
    # Get session ID
    session_id = request.cookies.get(settings.session_cookie_name)
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please login first."
        )
    
    # Get Drive client
    drive_client = get_drive_client(session_id)
    if not drive_client:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session"
        )
    
    try:
        # Load from Drive
        scenario_data = drive_client.load_scenario(scenario_id)
        
        if not scenario_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scenario '{scenario_id}' not found in Google Drive"
            )
        
        logger.info(f"Loaded scenario from Drive: {scenario_id}")
        
        return scenario_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error loading from Drive: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load from Google Drive: {str(e)}"
        )


@router.get("/scenarios/list")
async def list_drive_scenarios(request: Request):
    """
    List all scenarios in Google Drive.
    
    Requires authentication.
    
    Args:
        request: HTTP request (for session cookie)
        
    Returns:
        List of scenario metadata
    """
    # Get session ID
    session_id = request.cookies.get(settings.session_cookie_name)
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please login first."
        )
    
    # Get Drive client
    drive_client = get_drive_client(session_id)
    if not drive_client:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session"
        )
    
    try:
        # List scenarios
        scenarios = drive_client.list_scenarios()
        
        return {
            "scenarios": scenarios,
            "count": len(scenarios)
        }
        
    except Exception as e:
        logger.error(f"Error listing Drive scenarios: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list scenarios: {str(e)}"
        )


@router.delete("/scenarios/{scenario_id}/drive")
async def delete_from_drive(scenario_id: str, request: Request):
    """
    Delete scenario from Google Drive.
    
    Requires authentication.
    
    Args:
        scenario_id: Scenario identifier
        request: HTTP request (for session cookie)
        
    Returns:
        Confirmation message
    """
    # Get session ID
    session_id = request.cookies.get(settings.session_cookie_name)
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please login first."
        )
    
    # Get Drive client
    drive_client = get_drive_client(session_id)
    if not drive_client:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session"
        )
    
    try:
        # Delete from Drive
        deleted = drive_client.delete_scenario(scenario_id)
        
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scenario '{scenario_id}' not found in Google Drive"
            )
        
        logger.info(f"Deleted scenario from Drive: {scenario_id}")
        
        return {
            "scenario_id": scenario_id,
            "message": "Scenario deleted from Google Drive successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting from Drive: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete from Google Drive: {str(e)}"
        )
