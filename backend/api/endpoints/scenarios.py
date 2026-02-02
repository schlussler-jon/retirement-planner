"""
Scenario management endpoints with PostgreSQL storage.

Replaces in-memory dict with proper database persistence and user isolation.
"""

from fastapi import APIRouter, Depends, HTTPException, Cookie
from typing import Optional, List
from sqlalchemy.orm import Session
import json

from models.scenario import Scenario
from db.models import get_db, ScenarioModel
from auth.session import get_user_from_session

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


def get_current_user_id(retirement_planner_session: Optional[str] = Cookie(None)) -> str:
    """
    Extract user ID from session cookie.
    
    Raises:
        HTTPException: If not authenticated
    """
    if not retirement_planner_session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = get_user_from_session(retirement_planner_session)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired")
    
    return user.id


@router.post("", status_code=201)
def create_scenario(
    scenario: Scenario,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Create a new scenario."""
    # Check if already exists
    existing = db.query(ScenarioModel).filter_by(
        user_id=user_id,
        scenario_id=scenario.scenario_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Scenario '{scenario.scenario_id}' already exists"
        )
    
    # Create new
    db_scenario = ScenarioModel(
        user_id=user_id,
        scenario_id=scenario.scenario_id,
        data=scenario.model_dump_json()
    )
    db.add(db_scenario)
    db.commit()
    
    return {
        "scenario_id": scenario.scenario_id,
        "scenario_name": scenario.scenario_name,
        "message": "Scenario created successfully"
    }


@router.get("")
def list_scenarios(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """List all scenarios for the current user."""
    db_scenarios = db.query(ScenarioModel).filter_by(user_id=user_id).all()
    
    scenarios = []
    for db_s in db_scenarios:
        try:
            data = json.loads(db_s.data)
            scenarios.append({
                "scenario_id": db_s.scenario_id,
                "scenario_name": data.get("scenario_name", ""),
                "people_count": len(data.get("people", [])),
                "income_streams_count": len(data.get("income_streams", [])),
                "accounts_count": len(data.get("accounts", [])),
            })
        except json.JSONDecodeError:
            continue
    
    return {"scenarios": scenarios, "count": len(scenarios)}


@router.get("/{scenario_id}")
def get_scenario(
    scenario_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Get a specific scenario."""
    db_scenario = db.query(ScenarioModel).filter_by(
        user_id=user_id,
        scenario_id=scenario_id
    ).first()
    
    if not db_scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    return json.loads(db_scenario.data)


@router.put("/{scenario_id}")
def update_scenario(
    scenario_id: str,
    scenario: Scenario,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Update an existing scenario."""
    if scenario_id != scenario.scenario_id:
        raise HTTPException(
            status_code=400,
            detail="Scenario ID in path must match scenario ID in body"
        )
    
    db_scenario = db.query(ScenarioModel).filter_by(
        user_id=user_id,
        scenario_id=scenario_id
    ).first()
    
    if not db_scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    db_scenario.data = scenario.model_dump_json()
    db.commit()
    
    return {
        "scenario_id": scenario.scenario_id,
        "scenario_name": scenario.scenario_name,
        "message": "Scenario updated successfully"
    }


@router.delete("/{scenario_id}")
def delete_scenario(
    scenario_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Delete a scenario."""
    db_scenario = db.query(ScenarioModel).filter_by(
        user_id=user_id,
        scenario_id=scenario_id
    ).first()
    
    if not db_scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    db.delete(db_scenario)
    db.commit()
    
    return {"scenario_id": scenario_id, "message": "Scenario deleted"}


@router.post("/{scenario_id}/validate")
def validate_scenario(
    scenario_id: str,
    scenario: Scenario,
    user_id: str = Depends(get_current_user_id)
):
    """
    Validate scenario without saving.
    
    Note: This doesn't require DB access - pure validation.
    """
    errors = []
    warnings = []
    
    # Basic validation
    if not scenario.scenario_name:
        errors.append("Scenario name is required")
    
    if not scenario.people:
        warnings.append("No people defined - projection may not be meaningful")
    
    if not scenario.income_streams and not scenario.accounts:
        warnings.append("No income streams or accounts - projection will show zero income")
    
    return {
        "valid": len(errors) == 0,
        "errors": errors if errors else None,
        "warnings": warnings if warnings else None
    }
