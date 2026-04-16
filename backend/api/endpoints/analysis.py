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
from api.utils.encryption import decrypt_data
from typing import Dict, Any, List
from openai import OpenAI
from datetime import date as date_type
from slowapi import Limiter
from slowapi.util import get_remote_address

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

# Rate limiter — shared key function with main.py
limiter = Limiter(key_func=get_remote_address)


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
    return user.id


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

    return Scenario(**json.loads(decrypt_data(db_scenario.data)))


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

    # Build age context for each person
    projection_start_year = int(scenario.global_settings.projection_start_month.split('-')[0])
    people_context = []
    for person in scenario.people:
        current_age = projection_start_year - person.birth_date.year
        fra = 67
        years_to_fra = max(0, fra - current_age)
        life_expectancy_age = person.life_expectancy_years or 85
        life_exp_year = person.birth_date.year + life_expectancy_age
        years_in_retirement = life_exp_year - projection_start_year
        years_to_medicare = max(0, 65 - current_age)
        years_to_rmds = max(0, 73 - current_age)
        status_label = {
            "working_full_time": "Working Full-Time",
            "working_part_time": "Working Part-Time",
            "self_employed": "Self-Employed",
            "retired": "Retired",
            "not_working": "Not Working",
        }.get(person.employment_status or "", "Unknown")
        retirement_note = ""
        if person.planned_retirement_date:
            ret_year = int(person.planned_retirement_date.split("-")[0])
            years_to_ret = max(0, ret_year - projection_start_year)
            retirement_note = f", plans to retire in {years_to_ret} year(s) ({person.planned_retirement_date})"
        ss_note = ""
        if person.social_security_start_date:
            ss_year = int(person.social_security_start_date.split("-")[0])
            ss_years = ss_year - projection_start_year
            ss_note = f", already receiving Social Security" if ss_years <= 0 else f", starting Social Security in {ss_years} year(s) ({person.social_security_start_date})"
        people_context.append(
            f"- {person.name}: age {current_age}, status: {status_label}{retirement_note}{ss_note}, "
            f"{'already past full retirement age (67)' if years_to_fra == 0 else f'{years_to_fra} years to full retirement age (67)'}, "
            f"{'already Medicare eligible' if years_to_medicare == 0 else f'{years_to_medicare} years to Medicare (65)'}, "
            f"{'RMDs already required' if years_to_rmds == 0 else f'{years_to_rmds} years to RMDs (73)'}, "
            f"life expectancy to age {life_expectancy_age} ({years_in_retirement} years of retirement to fund)"
        )
    people_age_context = '\n'.join(people_context)

    pct = lambda n: (n / ending_portfolio * 100) if ending_portfolio else 0

    # ── Situational flags (computed before prompt so GPT gets clear directives) ──

    # Years to retirement (youngest working person)
    years_to_retirement = 999
    for person in scenario.people:
        age = projection_start_year - person.birth_date.year
        is_working = getattr(person, 'employment_status', '') in [
            'working_full_time', 'working_part_time', 'self_employed'
        ]
        if is_working and person.planned_retirement_date:
            ret_yr = int(person.planned_retirement_date.split('-')[0])
            years_to_retirement = min(years_to_retirement, max(0, ret_yr - projection_start_year))
        elif is_working:
            years_to_retirement = min(years_to_retirement, max(0, 65 - age))
    if years_to_retirement == 999:
        youngest_age = min(projection_start_year - p.birth_date.year for p in scenario.people)
        years_to_retirement = max(0, 65 - youngest_age) if youngest_age < 60 else 0

    # Roth strategy guidance
    all_retired = all(
        getattr(p, 'employment_status', '') in ['retired', 'not_working']
        for p in scenario.people
    )
    far_from_retirement = years_to_retirement > 10
    near_retirement     = 3 <= years_to_retirement <= 10
    rmd_imminent        = any(
        (projection_start_year - p.birth_date.year) >= 70
        for p in scenario.people
    )

    if far_from_retirement:
        roth_guidance = (
            "ROTH GUIDANCE: This person is more than 10 years from retirement. "
            "Roth CONVERSIONS are NOT recommended — they're better off maximizing Roth CONTRIBUTIONS "
            "(Roth IRA, Roth 401k) to build tax-free assets over time. "
            "Do NOT suggest conversions. DO suggest Roth contribution strategies."
        )
    elif near_retirement:
        roth_guidance = (
            "ROTH GUIDANCE: This person is 3-10 years from retirement — a key window. "
            "Roth conversions ARE worth discussing if they're in a lower bracket now than they will be in retirement. "
            "Suggest partial conversions up to the top of their current bracket."
        )
    elif all_retired or years_to_retirement == 0:
        if rmd_imminent:
            roth_guidance = (
                "ROTH GUIDANCE: This person is near or past RMD age (73). "
                "Conversions are still possible but the window is narrowing. "
                "Focus on managing RMD income to minimize Medicare IRMAA surcharges and bracket creep. "
                "Qualified Charitable Distributions (QCDs) up to $105,000/year can satisfy RMDs tax-free."
            )
        else:
            roth_guidance = (
                "ROTH GUIDANCE: This person is recently retired — the Roth conversion window is open. "
                "If income is lower than it was during working years, conversions now can reduce future RMDs "
                "and Medicare premiums. Suggest converting up to the top of the 22% or 24% bracket each year."
            )
    else:
        roth_guidance = (
            "ROTH GUIDANCE: This person is within 3 years of retirement. "
            "Focus on Roth conversions in the gap years between retirement and Social Security / RMDs "
            "when income is typically at its lowest. This is the optimal conversion window."
        )

    # Plan health directive
    if success_rate >= 90:
        plan_health = (
            "PLAN HEALTH: This plan is strong. Lead with confidence. "
            "Focus on optimization — Roth conversions, tax efficiency, legacy planning. "
            "Don't manufacture concerns."
        )
    elif success_rate >= 70:
        plan_health = (
            "PLAN HEALTH: This plan is workable but has meaningful risk. "
            "Be honest about the vulnerability. Identify the 1-2 levers that would most improve the outlook."
        )
    else:
        plan_health = (
            "PLAN HEALTH: This plan is at serious risk. "
            "Lead with the problem directly — don't soften it. "
            "The optimization checklist must focus on deficit reduction first: spending cuts, income extension, "
            "delayed Social Security, reduced withdrawal rates."
        )

    # Legacy/estate planning guidance
    trust_eligible = ending_portfolio > 250_000 and len(scenario.people) >= 1

    if ending_portfolio > 1_000_000 and trust_eligible:
        legacy_guidance = (
            "LEGACY PLANNING: This is a high-net-worth situation. "
            "Discuss revocable living trusts to avoid probate, irrevocable trusts for estate tax planning "
            "(federal threshold is $13.6M but many states are lower), gifting strategies ($18,000/year annual exclusion), "
            "and Roth accounts as the most tax-efficient inheritance. "
            "As assets grow, estate planning will become increasingly important."
        )
    elif ending_portfolio > 500_000 and trust_eligible:
        legacy_guidance = (
            "LEGACY PLANNING: Include a note about basic estate planning: "
            "a revocable living trust is worth considering — it avoids probate on property, "
            "ensures assets transfer smoothly if incapacitated, and keeps finances private. "
            "Ensure beneficiary designations are current on all accounts, "
            "and note that Roth accounts are the most tax-efficient assets to pass to heirs."
            )
    else:
        legacy_guidance = (
            "LEGACY PLANNING: Focus is on building wealth first. "
            "Mention that keeping beneficiary designations current on all accounts is a simple but important step."
        )

    # Income stream optimization
    has_ss = any(s.type.value == 'social_security' for s in scenario.income_streams)
    ss_started = any(
        s.type.value == 'social_security' and s.start_month <= f"{projection_start_year}-01"
        for s in scenario.income_streams
    )
    any_working = any(
        getattr(p, 'employment_status', '') in ['working_full_time', 'working_part_time', 'self_employed']
        for p in scenario.people
    )

    ss_guidance = ""
    if has_ss and not ss_started and any_working:
        ss_guidance = (
            "SOCIAL SECURITY: They have Social Security modeled but haven't started it yet. "
            "If they can afford to delay, emphasize the 8%/year increase from delaying past full retirement age to 70."
        )
    elif not has_ss:
        ss_guidance = (
            "SOCIAL SECURITY: No Social Security income is modeled. "
            "If they're eligible, remind them to factor this in — it could significantly improve their plan."
        )

    prompt = f"""You are a Certified Financial Planner analyzing a retirement scenario for {greeting}. Generate a professional, personalized analysis following this EXACT structure.

CLIENT SCENARIO:
- Planning horizon: {total_years} years
- Starting portfolio: ${starting_portfolio:,.0f}
- Ending portfolio: ${ending_portfolio:,.0f}
- Portfolio growth: {portfolio_growth_pct:.1f}% (${portfolio_growth:,.0f})
- Success rate: {success_rate:.0f}% months in surplus
- Average monthly surplus: ${avg_monthly_surplus:,.0f}
- Cumulative surplus: ${total_surplus:,.0f}
- Years to retirement: {years_to_retirement if years_to_retirement > 0 else 'Already retired'}

HOUSEHOLD AGES & MILESTONES:
{people_age_context}

TAX ARCHITECTURE:
- Tax-deferred: ${tax_deferred:,.0f} ({pct(tax_deferred):.1f}%)
- Roth: ${roth:,.0f} ({pct(roth):.1f}%)
- Taxable: ${taxable:,.0f} ({pct(taxable):.1f}%)
- Effective tax rate: {effective_tax_rate:.1f}%
- Total taxes paid: ${total_taxes:,.0f}

SITUATIONAL DIRECTIVES (follow precisely — these override general advice):

{plan_health}

{roth_guidance}

{legacy_guidance}

{ss_guidance if ss_guidance else ''}

RETIREMENT CONTRIBUTION RULES:
- Retired or not working → do NOT suggest new 401k/IRA contributions (earned income required)
- Working → suggest maxing contributions appropriate to their age and bracket
- Pre-tax contributions reduce taxable income now; Roth contributions build tax-free wealth

REQUIREMENTS:
1. **Executive Summary (2 sentences)**: State plan health directly. Name the single most important lever.

2. **Strategic Observations (3 bullets)**:
   - Plan Viability: interpret success rate honestly — if at risk, say so clearly
   - Tax Architecture: comment on bucket balance and what it means for retirement flexibility
   - Roth Strategy: give age-appropriate Roth advice per the directive above

3. **Optimization Checklist (3-4 actions)**: Specific, dollar-amount actions ranked by impact. If plan is at risk, lead with deficit-reduction actions.

4. **Age-Specific Guidance**: Reference each person by name. Call out upcoming milestones — Social Security timing, Medicare at 65, RMDs at 73.

5. **Legacy & Wealth Transfer**: Based on ending portfolio size, give appropriate estate planning guidance — trusts, beneficiary designations, Roth inheritance advantages, gifting strategies.

6. **Future State**: 2-3 sentences — what life looks like in 15 years if they follow vs ignore this advice.

CONSTRAINTS:
- Address {greeting} directly using "you" and "your"
- Plain conversational language — no jargon
- Be direct about risks — don't sugarcoat a failing plan
- Maximum 500 words
- Clean markdown, no code fences

Generate analysis:"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a trusted financial advisor explaining retirement planning to a friend. Use simple, clear language without jargon. Be warm but professional."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=900
        )
        analysis = response.choices[0].message.content
        analysis = analysis.replace('```markdown', '').replace('```', '').strip()
        return analysis

    except Exception as e:
        # Log the real error but don't expose API details to the client
        logger.error(f"OpenAI API error during analysis generation: {e}", exc_info=True)
        return f"""# Analysis Temporarily Unavailable

The AI analysis service is temporarily unavailable. Your projection data is shown below.

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
@limiter.limit("5/hour")  # GPT-4o is expensive — 5 analyses per hour per IP
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
            detail="Unable to generate analysis. Please try again.",
        )
