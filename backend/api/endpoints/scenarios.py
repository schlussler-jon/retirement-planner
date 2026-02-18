"""
Scenario management endpoints with user isolation.

Each user can only see and modify their own scenarios.
"""

from fastapi import APIRouter, HTTPException, status, Request, Depends, UploadFile, File
from pydantic import BaseModel, ValidationError
from typing import Dict, Any, Optional
import logging
import json

from models import Scenario
from auth.session import get_user_from_session

logger = logging.getLogger(__name__)

router = APIRouter()

# User-scoped scenarios: {user_email: {scenario_id: Scenario}}
scenarios_db: Dict[str, Dict[str, Scenario]] = {}


def get_current_user_id(request: Request) -> str:
    """
    Extract user ID from session cookie.
    """
    from auth.config import get_oauth_settings
    settings = get_oauth_settings()
    
    # DEBUG LOGGING
    logger.info(f"Cookies in request: {request.cookies}")
    logger.info(f"Looking for cookie: {settings.session_cookie_name}")
    
    session_id = request.cookies.get(settings.session_cookie_name)
    logger.info(f"Session ID found: {session_id}")
    
    if not session_id:
        logger.error("No session cookie found!")
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = get_user_from_session(session_id)
    logger.info(f"User from session: {user}")
    
    if not user:
        logger.error("Session expired or invalid!")
        raise HTTPException(status_code=401, detail="Session expired")
    
    return user.email

def get_user_scenarios(user_id: str) -> Dict[str, Scenario]:
    """Get or create user's scenario dict."""
    if user_id not in scenarios_db:
        scenarios_db[user_id] = {}
    return scenarios_db[user_id]


class ScenarioResponse(BaseModel):
    """Response model for scenario operations."""
    scenario_id: str
    scenario_name: str
    message: str


class ScenarioListItem(BaseModel):
    """Abbreviated scenario info for list view."""
    scenario_id: str
    scenario_name: str
    people_count: int
    income_streams_count: int
    accounts_count: int


class ScenarioListResponse(BaseModel):
    """Response model for scenario list."""
    scenarios: list[ScenarioListItem]
    count: int


@router.post("/scenarios", response_model=ScenarioResponse)
async def create_scenario(
    scenario_data: Dict[str, Any],
    user_id: str = Depends(get_current_user_id)
):
    """
    Create a new retirement planning scenario.
    
    Args:
        scenario_data: Complete scenario configuration
        user_id: Authenticated user ID from session
        
    Returns:
        ScenarioResponse with scenario_id and confirmation
        
    Raises:
        400: Invalid scenario data
        409: Scenario with this ID already exists for this user
    """
    try:
        # Add defaults for missing fields (backwards compatibility)
        if 'global_settings' not in scenario_data:
            scenario_data['global_settings'] = {
                'projection_start_month': '2025-01',
                'projection_end_year': 2055,
                'residence_state': 'CA'
            }
        
        if 'tax_settings' not in scenario_data:
            scenario_data['tax_settings'] = {
                'filing_status': 'married_filing_jointly',
                'standard_deduction_override': None
            }
        
        # Parse and validate scenario
        scenario = Scenario(**scenario_data)
        
        # Validate references
        scenario.validate_references()
        
        # Get user's scenarios
        user_scenarios = get_user_scenarios(user_id)
        
        # Check if scenario already exists for THIS user
        if scenario.scenario_id in user_scenarios:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Scenario '{scenario.scenario_id}' already exists. Use PUT to update."
            )
        
        # Store scenario under user's namespace
        user_scenarios[scenario.scenario_id] = scenario
        
        logger.info(f"User {user_id} created scenario: {scenario.scenario_id}")
        
        return ScenarioResponse(
            scenario_id=scenario.scenario_id,
            scenario_name=scenario.scenario_name,
            message="Scenario created successfully"
        )
        
    except ValidationError as e:
        logger.error(f"Validation error creating scenario: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid scenario data: {str(e)}"
        )


@router.get("/scenarios/{scenario_id}")
async def get_scenario(
    scenario_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get a specific scenario by ID.
    
    Args:
        scenario_id: Scenario identifier
        user_id: Authenticated user ID from session
        
    Returns:
        Complete scenario data
        
    Raises:
        404: Scenario not found for this user
    """
    user_scenarios = get_user_scenarios(user_id)
    scenario = user_scenarios.get(scenario_id)
    
    if scenario is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario '{scenario_id}' not found"
        )
    
    return scenario


@router.put("/scenarios/{scenario_id}", response_model=ScenarioResponse)
async def update_scenario(
    scenario_id: str,
    scenario_data: Dict[str, Any],
    user_id: str = Depends(get_current_user_id)
):
    """
    Update an existing scenario.
    
    Args:
        scenario_id: Scenario identifier from URL
        scenario_data: Updated scenario configuration
        user_id: Authenticated user ID from session
        
    Returns:
        ScenarioResponse with confirmation
        
    Raises:
        400: Invalid data or ID mismatch
        404: Scenario not found for this user
    """
    try:
        # Add defaults for missing fields
        if 'global_settings' not in scenario_data:
            scenario_data['global_settings'] = {
                'projection_start_month': '2025-01',
                'projection_end_year': 2055,
                'residence_state': 'CA'
            }
        
        if 'tax_settings' not in scenario_data:
            scenario_data['tax_settings'] = {
                'filing_status': 'married_filing_jointly',
                'standard_deduction_override': None
            }
        
        scenario = Scenario(**scenario_data)
        
        if scenario_id != scenario.scenario_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Scenario ID in path must match scenario ID in body"
            )
        
        scenario.validate_references()
        
        user_scenarios = get_user_scenarios(user_id)
        
        if scenario_id not in user_scenarios:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scenario '{scenario_id}' not found"
            )
        
        user_scenarios[scenario_id] = scenario
        
        logger.info(f"User {user_id} updated scenario: {scenario_id}")
        
        return ScenarioResponse(
            scenario_id=scenario.scenario_id,
            scenario_name=scenario.scenario_name,
            message="Scenario updated successfully"
        )
        
    except ValidationError as e:
        logger.error(f"Validation error updating scenario: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid scenario data: {str(e)}"
        )


@router.delete("/scenarios/{scenario_id}")
async def delete_scenario(
    scenario_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Delete a scenario.
    
    Args:
        scenario_id: Scenario identifier
        user_id: Authenticated user ID from session
        
    Returns:
        Confirmation message
        
    Raises:
        404: Scenario not found for this user
    """
    user_scenarios = get_user_scenarios(user_id)
    
    if scenario_id not in user_scenarios:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario '{scenario_id}' not found"
        )
    
    del user_scenarios[scenario_id]
    
    logger.info(f"User {user_id} deleted scenario: {scenario_id}")
    
    return {
        "scenario_id": scenario_id,
        "message": "Scenario deleted successfully"
    }


@router.get("/scenarios", response_model=ScenarioListResponse)
async def list_scenarios(
    user_id: str = Depends(get_current_user_id)
):
    """
    List all scenarios for the authenticated user.
    
    Args:
        user_id: Authenticated user ID from session
        
    Returns:
        List of scenario summaries
    """
    user_scenarios = get_user_scenarios(user_id)
    
    scenario_list = []
    for scenario_id, scenario in user_scenarios.items():
        scenario_list.append(ScenarioListItem(
            scenario_id=scenario.scenario_id,
            scenario_name=scenario.scenario_name,
            people_count=len(scenario.people),
            income_streams_count=len(scenario.income_streams),
            accounts_count=len(scenario.accounts),
        ))
    
    return ScenarioListResponse(
        scenarios=scenario_list,
        count=len(scenario_list)
    )


@router.post("/scenarios/import")
async def import_scenario(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id)
):
    """
    Import a scenario from a JSON file.
    
    Args:
        file: JSON file containing scenario data
        user_id: Authenticated user ID from session
        
    Returns:
        ScenarioResponse with imported scenario info
        
    Raises:
        400: Invalid file or JSON format
    """
    try:
        contents = await file.read()
        scenario_data = json.loads(contents)
        
        # Add defaults for backwards compatibility
        if 'global_settings' not in scenario_data:
            scenario_data['global_settings'] = {
                'projection_start_month': '2025-01',
                'projection_end_year': 2055,
                'residence_state': 'CA'
            }
        
        if 'tax_settings' not in scenario_data:
            scenario_data['tax_settings'] = {
                'filing_status': 'married_filing_jointly',
                'standard_deduction_override': None
            }
        
        scenario = Scenario(**scenario_data)
        scenario.validate_references()
        
        user_scenarios = get_user_scenarios(user_id)
        
        # If scenario exists, add suffix to make unique
        original_id = scenario.scenario_id
        counter = 1
        while scenario.scenario_id in user_scenarios:
            scenario.scenario_id = f"{original_id}-{counter}"
            counter += 1
        
        user_scenarios[scenario.scenario_id] = scenario
        
        logger.info(f"User {user_id} imported scenario: {scenario.scenario_id}")
        
        return ScenarioResponse(
            scenario_id=scenario.scenario_id,
            scenario_name=scenario.scenario_name,
            message="Scenario imported successfully"
        )
        
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON file"
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid scenario data: {str(e)}"
        )


@router.post("/scenarios/{scenario_id}/validate")
async def validate_scenario(
    scenario_id: str,
    scenario_data: Dict[str, Any],
    user_id: str = Depends(get_current_user_id)
):
    """
    Validate scenario without saving.
    
    Args:
        scenario_id: Scenario identifier
        scenario_data: Scenario configuration to validate
        user_id: Authenticated user ID (required but not used for validation)
        
    Returns:
        Validation results with errors and warnings
    """
    errors = []
    warnings = []
    
    try:
        scenario = Scenario(**scenario_data)
        scenario.validate_references()
        
        # Additional warnings
        if not scenario.people:
            warnings.append("No people defined - projection may not be meaningful")
        
        if not scenario.income_streams and not scenario.accounts:
            warnings.append("No income streams or accounts - projection will show zero income")
        
    except ValidationError as e:
        errors = [str(err) for err in e.errors()]
    
    return {
        "valid": len(errors) == 0,
        "errors": errors if errors else None,
        "warnings": warnings if warnings else None
    }