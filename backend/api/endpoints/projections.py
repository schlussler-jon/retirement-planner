"""
Projections endpoint.

Runs complete retirement planning projections using the calculation engine.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging
import time

from models import Scenario, MonthlyProjection, TaxSummary, NetIncomeProjection, InvestmentAccount
from engine import ProjectionEngine, AnnualAggregator
from tax import calculate_taxes_for_projection
from budget import (
    BudgetProcessor,
    calculate_net_income_projections,
    get_financial_summary,
    get_annual_summaries,
)
from .scenarios import scenarios_db

logger = logging.getLogger(__name__)

router = APIRouter()

def apply_surplus_to_accounts(
    monthly_projections: List[MonthlyProjection],
    net_income_projections: List[NetIncomeProjection],
    accounts: List[InvestmentAccount]
) -> None:
    """
    Apply monthly surplus/deficit to designated account balances.
    
    Modifies monthly_projections in-place by adjusting balances_by_account
    to reflect cumulative surplus flowing into the receives_surplus account.
    
    Args:
        monthly_projections: Monthly projection results (modified in-place)
        net_income_projections: Net income projections with surplus calculated
        accounts: Investment accounts from scenario
    """
    # Find the account that receives surplus
    surplus_account = next(
        (acc for acc in accounts if acc.receives_surplus),
        None
    )
    
    if not surplus_account:
        # No account designated - surplus stays as uninvested cash
        return

    logger.info(f"Applying surplus to account: {surplus_account.name} (ID: {surplus_account.account_id})")
    
    # Track cumulative surplus across all months
    cumulative_surplus = 0.0
    
    for monthly_proj, net_income_proj in zip(monthly_projections, net_income_projections):
        # Add this month's surplus to cumulative total
        cumulative_surplus += net_income_proj.surplus_deficit
        
        # Update the designated account's balance
        account_id = surplus_account.account_id
        if account_id in monthly_proj.balances_by_account:
            monthly_proj.balances_by_account[account_id] += cumulative_surplus
            logger.info(f"Month {monthly_proj.month}: Added ${cumulative_surplus:,.0f} to {surplus_account.name}. New balance: ${monthly_proj.balances_by_account[account_id]:,.0f}")
        else:
            logger.warning(f"Account {account_id} not found in balances for month {monthly_proj.month}")
        
        # Also update total investments
        monthly_proj.total_investments += cumulative_surplus
        
        # Update tax bucket totals
        bucket = surplus_account.tax_bucket
        if bucket in monthly_proj.balances_by_tax_bucket:
            monthly_proj.balances_by_tax_bucket[bucket] += cumulative_surplus

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


@router.post("/scenarios/{scenario_id}/projection", response_model=ProjectionResponse)
async def calculate_projection(
    scenario_id: str,
    request: ProjectionRequest = ProjectionRequest()
):
    """
    Calculate complete retirement projection for a scenario.
    
    This endpoint runs the complete calculation pipeline:
    1. Monthly projections (income, accounts, COLA, growth)
    2. Tax calculations (SSA, federal, state)
    3. Budget processing (inflation, survivor reduction)
    4. Net income calculations (surplus/deficit)
    
    Args:
        scenario_id: Scenario identifier
        request: Configuration for what to include in response
        
    Returns:
        ProjectionResponse with requested calculations
        
    Raises:
        404: Scenario not found
        500: Calculation error
    """
    # Get scenario
    logger.info(f"=== PROJECTION ENDPOINT CALLED for scenario: {scenario_id} ===")
    scenario = scenarios_db.get(scenario_id)
    if scenario is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario '{scenario_id}' not found"
        )
    
    start_time = time.time()
    
    try:
        logger.info(f"Starting projection for scenario: {scenario_id}")
        
        # Phase 2: Run monthly projection
        engine = ProjectionEngine(scenario)
        monthly_projections = engine.run()
        
        logger.info(f"Generated {len(monthly_projections)} monthly projections")
        
        # Phase 3: Calculate taxes
        tax_summaries = calculate_taxes_for_projection(
            monthly_projections,
            scenario.income_streams,
            scenario.tax_settings.filing_status,
            scenario.global_settings.residence_state,
            scenario.tax_settings.standard_deduction_override
        )
        
        logger.info(f"Calculated taxes for {len(tax_summaries)} years")
        
        # Phase 4a: Process budget
        budget_processor = BudgetProcessor(
            scenario.budget_settings,
            scenario.people
        )
        
        spending_amounts = []
        for proj in monthly_projections:
            year_month = proj.month
            month_num = int(year_month.split('-')[1])
            spending = budget_processor.process_month(year_month, month_num)
            spending_amounts.append(spending)
        
        logger.info(f"Processed budget for {len(spending_amounts)} months")
        
        # Phase 4b: Calculate net income
        net_income_projections = calculate_net_income_projections(
            monthly_projections,
            tax_summaries,
            spending_amounts
        )
        
        logger.info(f"Calculated net income for {len(net_income_projections)} months")
        
        # Apply surplus/deficit to designated account
        apply_surplus_to_accounts(
            monthly_projections,
            net_income_projections,
            scenario.accounts
        )
        
        logger.info("Applied surplus/deficit to designated account")
        
        # Generate annual summaries        
        # Generate annual summaries
        aggregator = AnnualAggregator(monthly_projections)
        annual_summaries = aggregator.aggregate()
        
        # Generate financial summary
        financial_summary = get_financial_summary(net_income_projections)
        
        # Add annual net income summaries
        annual_net_income = get_annual_summaries(net_income_projections)
        
        calculation_time = (time.time() - start_time) * 1000  # Convert to ms
        
        logger.info(f"Projection completed in {calculation_time:.2f}ms")
        
        # Build response
        response = ProjectionResponse(
            scenario_id=scenario.scenario_id,
            scenario_name=scenario.scenario_name,
            calculation_time_ms=calculation_time,
            financial_summary=financial_summary
        )
        
        # Add optional sections based on request
        if request.include_monthly:
            response.monthly_projections = [
                proj.model_dump() for proj in monthly_projections
            ]
        
        if request.include_annual:
            response.annual_summaries = annual_summaries
        
        if request.include_tax_summary:
            response.tax_summaries = [
                tax.model_dump() for tax in tax_summaries
            ]
        
        if request.include_net_income:
            response.net_income_projections = [
                proj.model_dump() for proj in net_income_projections
            ]
        
        return response
        
    except Exception as e:
        logger.error(f"Error calculating projection: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating projection: {str(e)}"
        )


@router.post("/scenarios/{scenario_id}/projection/quick")
async def quick_projection(scenario_id: str):
    """
    Calculate a quick projection with minimal data.
    
    Returns only the financial summary for faster response times.
    
    Args:
        scenario_id: Scenario identifier
        
    Returns:
        Quick summary of projection results
        
    Raises:
        404: Scenario not found
        500: Calculation error
    """
    # Get scenario
    scenario = scenarios_db.get(scenario_id)
    if scenario is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario '{scenario_id}' not found"
        )
    
    start_time = time.time()
    
    try:
        # Run minimal projection
        engine = ProjectionEngine(scenario)
        monthly_projections = engine.run()
        
        # Calculate taxes
        tax_summaries = calculate_taxes_for_projection(
            monthly_projections,
            scenario.income_streams,
            scenario.tax_settings.filing_status,
            scenario.global_settings.residence_state
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

        # Apply surplus/deficit to designated account
        apply_surplus_to_accounts(
            monthly_projections,
            net_income_projections,
            scenario.accounts
        )
            
        # Get summary only
        financial_summary = get_financial_summary(net_income_projections)
        
        calculation_time = (time.time() - start_time) * 1000
        
        # Add some key metrics
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
            "financial_summary": financial_summary
        }
        
    except Exception as e:
        logger.error(f"Error calculating quick projection: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating projection: {str(e)}"
        )
