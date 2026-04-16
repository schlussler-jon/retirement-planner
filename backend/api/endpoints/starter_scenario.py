"""
Starter Scenario endpoint.

Creates a realistic pre-filled sample scenario for new users who have
no scenarios yet. The scenario features two people, mixed income streams,
three tax buckets, and a plan health score in the 70s — healthy enough
to be encouraging, with enough room to make the optimization tools interesting.

Sample household: Alex & Jordan Taylor, both working, retiring 2030-2033.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
import uuid
import json
import logging

from db.models import get_db, ScenarioModel
from auth.session import get_user_from_session
from auth.config import get_oauth_settings
from api.utils.encryption import encrypt_data

logger = logging.getLogger(__name__)
router = APIRouter()


def get_current_user_id(request: Request) -> str:
    settings = get_oauth_settings()
    session_id = request.cookies.get(settings.session_cookie_name)
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = get_user_from_session(session_id)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired")
    return user.id


def build_starter_scenario(scenario_id: str) -> dict:
    """
    Build a realistic starter scenario dict.

    Design goals:
    - Two people with different retirement dates and milestones
    - Pension + Social Security + Salary income streams
    - Mix of tax-deferred (dominant), Roth, and taxable accounts
    - Realistic budget categories
    - Health score lands in the low-to-mid 70s:
        • Survival rate ~90%      → ~27/30 pts
        • Portfolio growth ~1.4x  → ~14/20 pts
        • Surplus cushion modest  → ~10/20 pts
        • Contribution util ~75%  → ~11/15 pts (room to max out)
        • Tax diversification 72% deferred → ~6/15 pts (Roth conversions needed)
      Total ≈ 68–74 → "On Track" with clear optimization opportunities
    """
    person_alex_id   = str(uuid.uuid4())
    person_jordan_id = str(uuid.uuid4())

    return {
        "scenario_id":   scenario_id,
        "scenario_name": "Sample — Alex & Jordan's Retirement Plan",
        "description": (
            "This is a sample scenario to help you explore the app. "
            "Edit any values to match your own situation, or create a new scenario from scratch."
        ),

        # ── Global settings ──────────────────────────────────────────────────
        "global_settings": {
            "projection_start_month": "2026-07",
            "projection_end_year":    2057,
            "residence_state":        "AZ",
        },

        # ── Tax ──────────────────────────────────────────────────────────────
        "tax_settings": {
            "filing_status":      "married_filing_jointly",
            "tax_year_ruleset":   2025,
        },

        # ── People ───────────────────────────────────────────────────────────
        # Alex: 59, retiring 2030. Jordan: 56, retiring 2033.
        "people": [
            {
                "person_id":              person_alex_id,
                "name":                   "Alex",
                "birth_date":             "1967-03-15",
                "life_expectancy_years":  87,
                "employment_status":      "working_full_time",
                "planned_retirement_date": "2030-01",
                "social_security_start_date": "2034-03",  # age 67
            },
            {
                "person_id":              person_jordan_id,
                "name":                   "Jordan",
                "birth_date":             "1970-09-22",
                "life_expectancy_years":  89,
                "employment_status":      "working_full_time",
                "planned_retirement_date": "2033-01",
                "social_security_start_date": "2037-09",  # age 67
            },
        ],

        # ── Income streams ───────────────────────────────────────────────────
        "income_streams": [
            # Alex's salary — ends at retirement
            {
                "stream_id":               str(uuid.uuid4()),
                "name":                    "Alex's Salary",
                "type":                    "salary",
                "owner_person_id":         person_alex_id,
                "monthly_amount_at_start": 6800.0,
                "start_month":             "2026-07",
                "end_month":               "2029-12",
            },
            # Jordan's salary — ends at retirement
            {
                "stream_id":               str(uuid.uuid4()),
                "name":                    "Jordan's Salary",
                "type":                    "salary",
                "owner_person_id":         person_jordan_id,
                "monthly_amount_at_start": 4400.0,
                "start_month":             "2026-07",
                "end_month":               "2032-12",
            },
            # Alex's Social Security — starts at 67
            {
                "stream_id":               str(uuid.uuid4()),
                "name":                    "Alex's Social Security",
                "type":                    "social_security",
                "owner_person_id":         person_alex_id,
                "monthly_amount_at_start": 2180.0,
                "start_month":             "2034-03",
                "end_month":               None,
            },
            # Jordan's Social Security — starts at 67
            {
                "stream_id":               str(uuid.uuid4()),
                "name":                    "Jordan's Social Security",
                "type":                    "social_security",
                "owner_person_id":         person_jordan_id,
                "monthly_amount_at_start": 1640.0,
                "start_month":             "2037-09",
                "end_month":               None,
            },
        ],

        # ── Investment accounts ──────────────────────────────────────────────
        # Portfolio: $523k total — 73% tax-deferred, 18% Roth, 9% taxable
        # Intentionally skewed toward tax-deferred to make Roth conversion
        # recommendations meaningful.
        "accounts": [
            # Alex's 401(k) — contributing now, withdrawing in retirement
            {
                "account_id":              str(uuid.uuid4()),
                "name":                    "Alex's 401(k)",
                "tax_bucket":              "tax_deferred",
                "starting_balance":        385000.0,
                "annual_return_rate":      0.07,
                "monthly_contribution":    1200.0,
                "monthly_withdrawal":      3400.0,
                "contribution_start_month": "2026-07",
                "contribution_end_month":  "2029-12",   # stops at retirement
                "withdrawal_start_month":  "2030-01",   # begins at retirement
                "withdrawal_end_month":    None,
            },
            # Roth IRA — both contributing, no withdrawals planned
            {
                "account_id":              str(uuid.uuid4()),
                "name":                    "Roth IRA",
                "tax_bucket":              "roth",
                "starting_balance":        94000.0,
                "annual_return_rate":      0.07,
                "monthly_contribution":    583.0,        # ≈ $7,000/yr IRA max
                "monthly_withdrawal":      0.0,
                "contribution_start_month": "2026-07",
                "contribution_end_month":  "2032-12",   # stops when Jordan retires
                "withdrawal_start_month":  None,
                "withdrawal_end_month":    None,
            },
            # Taxable brokerage — no regular contributions or withdrawals
            {
                "account_id":              str(uuid.uuid4()),
                "name":                    "Taxable Brokerage",
                "tax_bucket":              "taxable",
                "starting_balance":        44000.0,
                "annual_return_rate":      0.06,
                "monthly_contribution":    0.0,
                "monthly_withdrawal":      0.0,
                "contribution_start_month": None,
                "contribution_end_month":  None,
                "withdrawal_start_month":  None,
                "withdrawal_end_month":    None,
            },
        ],

        # ── Budget ───────────────────────────────────────────────────────────
        "budget_settings": {
            "inflation_annual_percent": 0.027,
            "categories": [
                {"name": "Housing",          "monthly_amount": 2600.0},
                {"name": "Food & Groceries",  "monthly_amount": 900.0},
                {"name": "Transportation",    "monthly_amount": 650.0},
                {"name": "Healthcare",        "monthly_amount": 480.0},
                {"name": "Utilities",         "monthly_amount": 340.0},
                {"name": "Entertainment",     "monthly_amount": 420.0},
                {"name": "Travel",            "monthly_amount": 380.0},
                {"name": "Insurance",         "monthly_amount": 310.0},
                {"name": "Miscellaneous",     "monthly_amount": 250.0},
            ],
        },
    }


@router.post("/scenarios/starter", status_code=201)
def create_starter_scenario(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Create a pre-filled sample scenario for the current user.

    Can be called any time — it always creates a new scenario with a
    fresh UUID so it never conflicts with existing ones.
    """
    user_id = get_current_user_id(request)

    scenario_id   = str(uuid.uuid4())
    scenario_data = build_starter_scenario(scenario_id)

    db_scenario = ScenarioModel(
        user_id=user_id,
        scenario_id=scenario_id,
        data=encrypt_data(json.dumps(scenario_data)),
    )
    db.add(db_scenario)
    db.commit()

    logger.info(f"Created starter scenario {scenario_id} for user {user_id}")

    return {
        "scenario_id":   scenario_id,
        "scenario_name": scenario_data["scenario_name"],
        "message":       "Sample scenario created successfully",
    }
