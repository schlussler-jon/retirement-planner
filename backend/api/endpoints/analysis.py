"""
Analysis endpoint.

Generates AI-powered financial analysis for scenarios.
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
import logging

from models import Scenario
from engine import ProjectionEngine
from tax import calculate_taxes_for_projection
from budget import (
    BudgetProcessor,
    calculate_net_income_projections,
    get_financial_summary,
)
from ...services.ai_analyzer import generate_financial_analysis  # Relative import - go up 3 levels
from .scenarios import scenarios_db
logger = logging.getLogger(__name__)

router = APIRouter()


class AnalysisResponse(BaseModel):
    """Response model for analysis."""
    scenario_id: str
    scenario_name: str
    analysis: str  # Markdown-formatted analysis


@router.post("/scenarios/{scenario_id}/analysis", response_model=AnalysisResponse)
async def get_ai_analysis(scenario_id: str):
    """
    Generate AI-powered financial analysis for a scenario.
    
    Runs projection, calculates taxes, and generates CFP-level analysis.
    
    Args:
        scenario_id: Scenario identifier
        
    Returns:
        AnalysisResponse with markdown-formatted analysis
        
    Raises:
        404: Scenario not found
        500: Analysis generation error
    """
    # Get scenario
    scenario = scenarios_db.get(scenario_id)
    if scenario is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario '{scenario_id}' not found"
        )
    
    try:
        logger.info(f"Generating AI analysis for scenario: {scenario_id}")
        
        # Run projection
        engine = ProjectionEngine(scenario)
        monthly_projections = engine.run()
        
        # Calculate taxes
        tax_summaries = calculate_taxes_for_projection(
            monthly_projections,
            scenario.income_streams,
            scenario.tax_settings.filing_status,
            scenario.global_settings.residence_state,
            scenario.tax_settings.standard_deduction_override
        )
        
        # Process budget
        budget_processor = BudgetProcessor(
            scenario.budget_settings,
            scenario.people
        )
        
        spending_amounts = []
        for proj in monthly_projections:
            month_num = int(proj.month.split('-')[1])
            spending = budget_processor.process_month(proj.month, month_num)
            spending_amounts.append(spending)
        
        # Calculate net income
        net_income_projections = calculate_net_income_projections(
            monthly_projections,
            tax_summaries,
            spending_amounts
        )
        
        # Get financial summary
        financial_summary = get_financial_summary(net_income_projections)
        
        # Generate AI analysis
        analysis = generate_financial_analysis(
            scenario,
            monthly_projections,
            tax_summaries,
            financial_summary
        )
        
        logger.info(f"AI analysis generated successfully for scenario: {scenario_id}")
        
        return AnalysisResponse(
            scenario_id=scenario.scenario_id,
            scenario_name=scenario.scenario_name,
            analysis=analysis
        )
        
    except Exception as e:
        logger.error(f"Error generating AI analysis: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating analysis: {str(e)}"
        )
