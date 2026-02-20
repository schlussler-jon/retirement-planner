"""
Analysis endpoint.

Generates AI-powered financial analysis for scenarios.
Looks up scenarios from PostgreSQL with proper user isolation.
"""

from fastapi import APIRouter, HTTPException, status, Request, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import logging
import os
import json
from typing import Dict, Any, List
from openai import OpenAI

from models import Scenario, MonthlyProjection, TaxSummary
from engine import ProjectionEngine
from tax import calculate_taxes_for_projection
from budget import (
    BudgetProcessor,
    calculate_net_income_projections,
    get_financial_summary,
)
from db.models import get_db, ScenarioModel
from auth.session import get_user_from_session
from auth.config import get_oauth_settings

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Auth + DB helpers ────────────────────────────────────────────────────

def get_current_user_id(request: Request) -> str:
    """Extract authenticated user ID from session cookie."""
    settings = get_oauth_settings()
    session_id = request.cookies.get(settings.session_cookie_name)
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = get_user_from_session(session_id)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired")
    return user.id  # matches how scenarios_db.py stores scenarios


def load_scenario(scenario_id: str, user_id: str, db: Session) -> Scenario:
    """Load a scenario from the database, enforcing user ownership."""
    db_scenario = db.query(ScenarioModel).filter_by(
        user_id=user_id,
        scenario_id=scenario_id,
    ).first()

    if not db_scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario '{scenario_id}' not found",
        )

    return Scenario(**json.loads(db_scenario.data))


# ─── AI analysis logic ────────────────────────────────────────────────────

def generate_financial_analysis(
    scenario: Scenario,
    monthly_projections: List[MonthlyProjection],
    tax_summaries: List[TaxSummary],
    financial_summary: Dict[str, Any]
) -> str:
    """Generate AI-powered financial analysis."""

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    total_months = len(monthly_projections)
    total_years = total_months // 12

    starting_portfolio = monthly_projections[0].total_investments if monthly_projections else 0
    ending_portfolio = monthly_projections[-1].total_investments if monthly_projections else 0
    portfolio_growth = ending_portfolio - starting_portfolio
    portfolio_growth_pct = ((ending_portfolio / starting_portfolio - 1) * 100) if starting_portfolio > 0 else 0

    final_balances = monthly_projections[-1].balances_by_tax_bucket if monthly_projections else {}
    tax_deferred = final_balances.get('tax_deferred', 0)
    roth = final_balances.get('roth', 0)
    taxable = final_balances.get('taxable', 0)

    total_surplus = financial_summary.get('total_surplus_deficit', 0)
    avg_monthly_surplus = financial_summary.get('average_monthly_surplus_deficit', 0)
    months_in_surplus = financial_summary.get('months_in_surplus', 0)
    success_rate = (months_in_surplus / total_months * 100) if total_months > 0 else 0

    total_federal_tax = sum(ts.federal_tax for ts in tax_summaries)
    total_state_tax = sum(ts.state_tax for ts in tax_summaries)
    total_taxes = total_federal_tax + total_state_tax

    total_income = sum(mp.total_gross_cashflow for mp in monthly_projections)
    effective_tax_rate = (total_taxes / total_income * 100) if total_income > 0 else 0

    person_names = [person.name for person in scenario.people]
    if len(person_names) == 1:
        greeting = f"{person_names[0]}"
    elif len(person_names) == 2:
        greeting = f"{person_names[0]} and {person_names[1]}"
    else:
        greeting = "your household"

    prompt = f"""You are a Certified Financial Planner analyzing a retirement scenario for {greeting}. Generate a professional analysis following this EXACT structure:

CLIENT SCENARIO:
- Planning horizon: {total_years} years
- Starting portfolio: ${starting_portfolio:,.0f}
- Ending portfolio: ${ending_portfolio:,.0f}
- Portfolio growth: {portfolio_growth_pct:.1f}% (${portfolio_growth:,.0f})
- Success rate: {success_rate:.0f}% months in surplus
- Average monthly surplus: ${avg_monthly_surplus:,.0f}
- Cumulative surplus: ${total_surplus:,.0f}

TAX ARCHITECTURE:
- Tax-deferred: ${tax_deferred:,.0f} ({tax_deferred/ending_portfolio*100:.1f}%)
- Roth: ${roth:,.0f} ({roth/ending_portfolio*100:.1f}%)
- Taxable: ${taxable:,.0f} ({taxable/ending_portfolio*100:.1f}%)
- Effective tax rate: {effective_tax_rate:.1f}%
- Total taxes paid: ${total_taxes:,.0f}

REQUIREMENTS:
1. **Executive Summary (2 sentences)**: State if on track and identify primary financial lever

2. **Strategic Observations (3 bullets)**:
   - Efficiency Gap: Analyze savings rate vs goals
   - Tax Architecture: Comment on tax bucket balance
   - Risk Reality: Interpret success rate

3. **Optimization Checklist (3 actions)**: Specific recommendations with dollar amounts

4. **Future State Visualization**: Life in 15 years if they follow vs don't follow advice

CONSTRAINTS:
- Address the analysis directly to {greeting} (use "you" and "your")
- Write in plain, conversational language - avoid technical jargon
- Explain concepts simply (e.g., "money in retirement accounts" instead of "tax-deferred vehicles")
- Use everyday analogies and relatable comparisons
- Be direct and actionable - focus on what they should DO
- Maximum 400 words
- Format in clean markdown WITHOUT code fences (no ```markdown tags)

Generate analysis:"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a trusted financial advisor explaining retirement planning to a friend. Use simple, clear language without jargon. Be warm but professional."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=800
        )
        analysis = response.choices[0].message.content
        analysis = analysis.replace('```markdown', '').replace('```', '').strip()
        return analysis

    except Exception as e:
        return f"""# Analysis Unavailable

Unable to generate AI analysis: {str(e)}

Your projection shows:
- Portfolio growth: {portfolio_growth_pct:.1f}%
- Success rate: {success_rate:.0f}%
- Cumulative surplus: ${total_surplus:,.0f}"""


# ─── Response model ───────────────────────────────────────────────────────

class AnalysisResponse(BaseModel):
    scenario_id: str
    scenario_name: str
    analysis: str


# ─── Endpoint ─────────────────────────────────────────────────────────────

@router.post("/scenarios/{scenario_id}/analysis", response_model=AnalysisResponse)
async def get_ai_analysis(
    scenario_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """Generate AI-powered financial analysis for a scenario."""
    user_id = get_current_user_id(request)
    scenario = load_scenario(scenario_id, user_id, db)

    try:
        logger.info(f"Generating AI analysis for: {scenario_id}")

        engine = ProjectionEngine(scenario)
        monthly_projections = engine.run()

        tax_summaries = calculate_taxes_for_projection(
            monthly_projections,
            scenario.income_streams,
            scenario.tax_settings.filing_status,
            scenario.global_settings.residence_state,
            scenario.tax_settings.standard_deduction_override,
        )

        budget_processor = BudgetProcessor(scenario.budget_settings, scenario.people)
        spending_amounts = [
            budget_processor.process_month(proj.month, int(proj.month.split('-')[1]))
            for proj in monthly_projections
        ]

        net_income_projections = calculate_net_income_projections(
            monthly_projections, tax_summaries, spending_amounts
        )

        financial_summary = get_financial_summary(net_income_projections)

        analysis = generate_financial_analysis(
            scenario, monthly_projections, tax_summaries, financial_summary
        )

        logger.info(f"AI analysis generated for: {scenario_id}")

        return AnalysisResponse(
            scenario_id=scenario.scenario_id,
            scenario_name=scenario.scenario_name,
            analysis=analysis,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating analysis: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating analysis: {str(e)}",
        )
