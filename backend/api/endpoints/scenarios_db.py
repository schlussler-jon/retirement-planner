"""
Scenario management endpoints with PostgreSQL storage.

Scenario data is encrypted at rest using AES-256 (Fernet) before being
written to the database. See backend/utils/encryption.py for details.

Scenario IDs are UUIDs generated on the frontend; backend generates one as
a safety net if none is provided.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
import json
import uuid

from models.scenario import Scenario
from db.models import get_db, ScenarioModel
from auth.session import get_user_from_session
from auth.config import get_oauth_settings
from utils.encryption import encrypt_data, decrypt_data

router = APIRouter()


def get_current_user_id(request: Request) -> str:
    """Extract user ID from session cookie."""
    settings = get_oauth_settings()
    session_id = request.cookies.get(settings.session_cookie_name)
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = get_user_from_session(session_id)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired")
    return user.id


# ── helpers ───────────────────────────────────────────────────────────────────

def _serialize(scenario: Scenario) -> str:
    """Serialize a scenario to encrypted JSON for storage."""
    return encrypt_data(scenario.model_dump_json())


def _deserialize(raw: str) -> dict:
    """Decrypt and parse a stored scenario back to a dict."""
    return json.loads(decrypt_data(raw))


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.post("/scenarios", status_code=201)
def create_scenario(
    scenario: Scenario,
    request: Request,
    db: Session = Depends(get_db),
):
    """Create a new scenario."""
    user_id = get_current_user_id(request)

    if not scenario.scenario_id:
        scenario.scenario_id = str(uuid.uuid4())

    existing = db.query(ScenarioModel).filter_by(
        user_id=user_id,
        scenario_id=scenario.scenario_id,
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Scenario '{scenario.scenario_id}' already exists",
        )

    db_scenario = ScenarioModel(
        user_id=user_id,
        scenario_id=scenario.scenario_id,
        data=_serialize(scenario),
    )
    db.add(db_scenario)
    db.commit()

    return {
        "scenario_id": scenario.scenario_id,
        "scenario_name": scenario.scenario_name,
        "message": "Scenario created successfully",
    }


@router.get("/scenarios")
def list_scenarios(request: Request, db: Session = Depends(get_db)):
    """List all scenarios for the current user."""
    user_id = get_current_user_id(request)
    db_scenarios = db.query(ScenarioModel).filter_by(user_id=user_id).all()

    scenarios = []
    for db_s in db_scenarios:
        try:
            data = _deserialize(db_s.data)
            scenarios.append({
                "scenario_id":          db_s.scenario_id,
                "scenario_name":        data.get("scenario_name", ""),
                "description":          data.get("description", ""),
                "people_count":         len(data.get("people", [])),
                "income_streams_count": len(data.get("income_streams", [])),
                "accounts_count":       len(data.get("accounts", [])),
            })
        except Exception:
            continue

    return {"scenarios": scenarios, "count": len(scenarios)}


@router.get("/scenarios/{scenario_id}")
def get_scenario(
    scenario_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """Get a specific scenario."""
    user_id = get_current_user_id(request)
    db_scenario = db.query(ScenarioModel).filter_by(
        user_id=user_id, scenario_id=scenario_id
    ).first()
    if not db_scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return _deserialize(db_scenario.data)


@router.put("/scenarios/{scenario_id}")
def update_scenario(
    scenario_id: str,
    scenario: Scenario,
    request: Request,
    db: Session = Depends(get_db),
):
    """Update an existing scenario."""
    user_id = get_current_user_id(request)
    if scenario_id != scenario.scenario_id:
        raise HTTPException(
            status_code=400,
            detail="Scenario ID in path must match scenario ID in body",
        )
    db_scenario = db.query(ScenarioModel).filter_by(
        user_id=user_id, scenario_id=scenario_id
    ).first()
    if not db_scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    db_scenario.data = _serialize(scenario)
    db.commit()

    return {
        "scenario_id": scenario.scenario_id,
        "scenario_name": scenario.scenario_name,
        "message": "Scenario updated successfully",
    }


@router.delete("/scenarios/{scenario_id}")
def delete_scenario(
    scenario_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """Delete a scenario."""
    user_id = get_current_user_id(request)
    db_scenario = db.query(ScenarioModel).filter_by(
        user_id=user_id, scenario_id=scenario_id
    ).first()
    if not db_scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    db.delete(db_scenario)
    db.commit()
    return {"scenario_id": scenario_id, "message": "Scenario deleted"}


@router.post("/scenarios/{scenario_id}/validate")
def validate_scenario(scenario_id: str, scenario: Scenario, request: Request):
    """Validate scenario without saving."""
    get_current_user_id(request)
    errors   = []
    warnings = []
    if not scenario.scenario_name:
        errors.append("Scenario name is required")
    if not scenario.people:
        warnings.append("No people defined - projection may not be meaningful")
    if not scenario.income_streams and not scenario.accounts:
        warnings.append("No income streams or accounts - projection will show zero income")
    return {
        "valid":    len(errors) == 0,
        "errors":   errors   if errors   else None,
        "warnings": warnings if warnings else None,
    }
