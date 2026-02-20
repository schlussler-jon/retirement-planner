"""
Projections endpoint.

Runs complete retirement planning projections using the calculation engine.
Looks up scenarios from PostgreSQL with proper user isolation.
"""

from fastapi import APIRouter, HTTPException, status, Request, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
import logging
import time
import json

from models import Scenario, MonthlyProjection, TaxSummary, NetIncomeProjection
from engine import ProjectionEngine, AnnualAggregator
from tax import calculate_taxes_for_projection
from budget import (
    BudgetProcessor,
    calculate_net_income_projections,
    get_financial_summary,
    get_annual_summaries,
)
from db.models import get_db, ScenarioModel
from auth.session import get_user_from_session
from auth.config import get_oauth_settings

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Auth + DB helpers ────────────────────────────────────────────────────

def get_current_user_email(request: Request) -> str:
    """Extract authenticated user email from session cookie."""
    settings = get_oauth_settings()
    session_id = request.cookies.get(settings.session_cookie_name)
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = get_user_from_session(session_id)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired")
    return user.email


def load_scenario(scenario_id: str, user_email: str, db: Session) -> Scenario:
    """
    Load a scenario from the database, enforcing user ownership.

    Raises 404 if not found (intentionally doesn't distinguish
    'not found' from 'belongs to another user' for security).
    """
    db_scenario = db.query(ScenarioModel).filter_by(
        user_id=user_email,
        scenario_id=scenario_id,
    ).first()

    if not db_scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario '{scenario_id}' not found",
        )

    return Scenario(**json.loads(db_scenario.data))


# ─── Request / Response models ────────────────────────────────────────────

class ProjectionRequest(BaseModel):
    """Request model for projection calculation."""
    include_monthly: bool = True
    include_annual: bool = True
    include_tax_summary: bool = True
    include_net_income: bool = True


class ProjectionResponse(BaseModel):
    """Response model for projection results."""
    scenario_id: str
    scenario_name: str
    calculation_time_ms: float
    monthly_projections: Optional[List[Dict[str, Any]]] = None
    annual_summaries: Optional[List[Dict[str, Any]]] = None
    tax_summaries: Optional[List[Dict[str, Any]]] = None
    net_income_projections: Optional[List[Dict[str, Any]]] = None
    financial_summary: Optional[Dict[str, Any]] = None


# ─── Endpoints ────────────────────────────────────────────────────────────

@router.post("/scenarios/{scenario_id}/projection", response_model=ProjectionResponse)
async def calculate_projection(
    scenario_id: str,
    request: Request,
    projection_request: ProjectionRequest = ProjectionRequest(),
    db: Session = Depends(get_db),
):
    """
    Calculate complete retirement projection for a scenario.

    Steps: monthly projections → tax calculations → budget processing
    → net income → annual summaries.
    """
    logger.info(f"=== PROJECTION ENDPOINT CALLED for scenario: {scenario_id} ===")

    user_email = get_current_user_email(request)
    scenario = load_scenario(scenario_id, user_email, db)

    start_time = time.time()

    try:
        logger.info(f"Starting projection for scenario: {scenario_id}")

        # Monthly projection (includes surplus reinvestment)
        engine = ProjectionEngine(scenario)
        monthly_projections = engine.run()
        logger.info(f"Generated {len(monthly_projections)} monthly projections")

        # Taxes
        tax_summaries = calculate_taxes_for_projection(
            monthly_projections,
            scenario.income_streams,
            scenario.tax_settings.filing_status,
            scenario.global_settings.residence_state,
            scenario.tax_settings.standard_deduction_override,
        )
        logger.info(f"Calculated taxes for {len(tax_summaries)} years")

        # Budget
        budget_processor = BudgetProcessor(scenario.budget_settings, scenario.people)
        spending_amounts = []
        for proj in monthly_projections:
            month_num = int(proj.month.split('-')[1])
            spending_amounts.append(budget_processor.process_month(proj.month, month_num))
        logger.info(f"Processed budget for {len(spending_amounts)} months")

        # Net income
        net_income_projections = calculate_net_income_projections(
            monthly_projections, tax_summaries, spending_amounts
        )
        logger.info(f"Calculated net income for {len(net_income_projections)} months")

        # Annual summaries
        aggregator = AnnualAggregator(monthly_projections)
        annual_summaries = aggregator.aggregate()

        # Financial summary
        financial_summary = get_financial_summary(net_income_projections)

        calculation_time = (time.time() - start_time) * 1000
        logger.info(f"Projection completed in {calculation_time:.2f}ms")

        response = ProjectionResponse(
            scenario_id=scenario.scenario_id,
            scenario_name=scenario.scenario_name,
            calculation_time_ms=calculation_time,
            financial_summary=financial_summary,
        )

        if projection_request.include_monthly:
            response.monthly_projections = [p.model_dump() for p in monthly_projections]
        if projection_request.include_annual:
            response.annual_summaries = annual_summaries
        if projection_request.include_tax_summary:
            response.tax_summaries = [t.model_dump() for t in tax_summaries]
        if projection_request.include_net_income:
            response.net_income_projections = [p.model_dump() for p in net_income_projections]

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating projection: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating projection: {str(e)}",
        )


@router.post("/scenarios/{scenario_id}/projection/quick")
async def quick_projection(
    scenario_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Calculate a quick projection — financial summary only, no full data tables.
    """
    user_email = get_current_user_email(request)
    scenario = load_scenario(scenario_id, user_email, db)

    start_time = time.time()

    try:
        engine = ProjectionEngine(scenario)
        monthly_projections = engine.run()

        tax_summaries = calculate_taxes_for_projection(
            monthly_projections,
            scenario.income_streams,
            scenario.tax_settings.filing_status,
            scenario.global_settings.residence_state,
        )

        budget_processor = BudgetProcessor(scenario.budget_settings, scenario.people)
        spending_amounts = []
        for proj in monthly_projections:
            month_num = int(proj.month.split('-')[1])
            spending_amounts.append(budget_processor.process_month(proj.month, month_num))

        net_income_projections = calculate_net_income_projections(
            monthly_projections, tax_summaries, spending_amounts
        )

        financial_summary = get_financial_summary(net_income_projections)
        calculation_time = (time.time() - start_time) * 1000

        first_month = monthly_projections[0]
        last_month = monthly_projections[-1]

        return {
            "scenario_id": scenario.scenario_id,
            "scenario_name": scenario.scenario_name,
            "calculation_time_ms": calculation_time,
            "total_months": len(monthly_projections),
            "starting_portfolio": first_month.total_investments,
            "ending_portfolio": last_month.total_investments,
            "portfolio_growth": last_month.total_investments - first_month.total_investments,
            "financial_summary": financial_summary,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating quick projection: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating projection: {str(e)}",
        )
