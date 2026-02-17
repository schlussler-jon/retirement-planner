"""
Scenarios endpoint.

Handles scenario creation, retrieval, validation, and updates.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ValidationError
from typing import Dict, Any, Optional
import logging

from models import Scenario

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory storage for scenarios (Phase 6 will add database)
scenarios_db: Dict[str, Scenario] = {}


class ScenarioResponse(BaseModel):
    """Response model for scenario operations."""
    scenario_id: str
    scenario_name: str
    message: str


class ValidationResponse(BaseModel):
    """Response model for validation."""
    valid: bool
    errors: Optional[list] = None
    warnings: Optional[list] = None


@router.post("/scenarios", response_model=ScenarioResponse, status_code=status.HTTP_201_CREATED)
async def create_scenario(scenario_data: Dict[str, Any]):
    """
    Create a new retirement planning scenario.
    
    Args:
        scenario_data: Complete scenario configuration
        
    Returns:
        ScenarioResponse with scenario_id and confirmation
        
    Raises:
        400: Invalid scenario data
        409: Scenario with this ID already exists
    """
    try:
        # Parse and validate scenario
        # Add defaults for missing fields (backwards compatibility with older exports)
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
        
        # Check if scenario already exists
        if scenario.scenario_id in scenarios_db:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Scenario '{scenario.scenario_id}' already exists. Use PUT to update."
            )
        
        # Store scenario
        scenarios_db[scenario.scenario_id] = scenario
        
        logger.info(f"Created scenario: {scenario.scenario_id}")
        
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
    except ValueError as e:
        logger.error(f"Reference validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/scenarios/{scenario_id}")
async def get_scenario(scenario_id: str):
    """
    Retrieve a scenario by ID.
    
    Args:
        scenario_id: Scenario identifier
        
    Returns:
        Complete scenario data
        
    Raises:
        404: Scenario not found
    """
    scenario = scenarios_db.get(scenario_id)
    
    if scenario is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario '{scenario_id}' not found"
        )
    
    # Return scenario as dict
    return scenario.model_dump()


@router.put("/scenarios/{scenario_id}", response_model=ScenarioResponse)
async def update_scenario(scenario_id: str, scenario_data: Dict[str, Any]):
    """
    Update an existing scenario.
    
    Args:
        scenario_id: Scenario identifier
        scenario_data: Updated scenario configuration
        
    Returns:
        ScenarioResponse with confirmation
        
    Raises:
        400: Invalid scenario data
        404: Scenario not found
    """
    # Check if scenario exists
    if scenario_id not in scenarios_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario '{scenario_id}' not found"
        )
    
    try:
        # Parse and validate scenario
        scenario = Scenario(**scenario_data)
        
        # Ensure scenario_id matches
        if scenario.scenario_id != scenario_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Scenario ID in path must match scenario ID in data"
            )
        
        # Validate references
        scenario.validate_references()
        
        # Update scenario
        scenarios_db[scenario_id] = scenario
        
        logger.info(f"Updated scenario: {scenario_id}")
        
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
    except ValueError as e:
        logger.error(f"Reference validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/scenarios/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scenario(scenario_id: str):
    """
    Delete a scenario.
    
    Args:
        scenario_id: Scenario identifier
        
    Raises:
        404: Scenario not found
    """
    if scenario_id not in scenarios_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario '{scenario_id}' not found"
        )
    
    del scenarios_db[scenario_id]
    logger.info(f"Deleted scenario: {scenario_id}")


@router.post("/scenarios/validate", response_model=ValidationResponse)
async def validate_scenario(scenario_data: Dict[str, Any]):
    """
    Validate a scenario without saving it.
    
    This is useful for client-side validation before submission.
    
    Args:
        scenario_data: Scenario configuration to validate
        
    Returns:
        ValidationResponse with validation results
    """
    errors = []
    warnings = []
    
    try:
        # Parse scenario
        scenario = Scenario(**scenario_data)
        
        # Validate references
        scenario.validate_references()
        
        # Additional validation checks
        # Check for reasonable values
        if scenario.global_settings.projection_end_year < 2026:
            warnings.append("Projection end year is in the past")
        
        if len(scenario.people) == 0:
            warnings.append("No people defined in scenario")
        
        if len(scenario.income_streams) == 0:
            warnings.append("No income streams defined")
        
        if len(scenario.accounts) == 0:
            warnings.append("No investment accounts defined")
        
        logger.info(f"Validated scenario: {scenario.scenario_id}")
        
        return ValidationResponse(
            valid=True,
            errors=None,
            warnings=warnings if warnings else None
        )
        
    except ValidationError as e:
        logger.warning(f"Validation failed: {e}")
        errors = [str(err) for err in e.errors()]
        return ValidationResponse(
            valid=False,
            errors=errors,
            warnings=None
        )
    except ValueError as e:
        logger.warning(f"Reference validation failed: {e}")
        return ValidationResponse(
            valid=False,
            errors=[str(e)],
            warnings=None
        )


@router.get("/scenarios")
async def list_scenarios():
    """
    List all scenarios.
    
    Returns:
        List of scenario summaries
    """
    summaries = []
    for scenario_id, scenario in scenarios_db.items():
        summaries.append({
            "scenario_id": scenario.scenario_id,
            "scenario_name": scenario.scenario_name,
            "people_count": len(scenario.people),
            "income_streams_count": len(scenario.income_streams),
            "accounts_count": len(scenario.accounts),
        })
    
    return {"scenarios": summaries, "count": len(summaries)}
