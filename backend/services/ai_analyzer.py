"""
AI-powered financial analysis service.

Generates professional CFP-level analysis using OpenAI GPT-4.
"""

import os
from typing import Dict, Any, List
from openai import OpenAI
from models import Scenario, MonthlyProjection, TaxSummary


def generate_financial_analysis(
    scenario: Scenario,
    monthly_projections: List[MonthlyProjection],
    tax_summaries: List[TaxSummary],
    financial_summary: Dict[str, Any]
) -> str:
    """
    Generate AI-powered financial analysis.
    Args:
        scenario: User's scenario
        monthly_projections: Monthly projection results
        tax_summaries: Tax calculation results
        financial_summary: Summary of surplus/deficit
        
    Returns:
        Formatted analysis text (markdown)
    """

    # Initialize OpenAI client (do this inside function to ensure env is loaded)
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    # Extract key metrics
    total_months = len(monthly_projections)
    total_years = total_months // 12
    
    starting_portfolio = monthly_projections[0].total_investments if monthly_projections else 0
    ending_portfolio = monthly_projections[-1].total_investments if monthly_projections else 0
    portfolio_growth = ending_portfolio - starting_portfolio
    portfolio_growth_pct = ((ending_portfolio / starting_portfolio - 1) * 100) if starting_portfolio > 0 else 0
    
    # Tax bucket analysis
    final_balances = monthly_projections[-1].balances_by_tax_bucket if monthly_projections else {}
    tax_deferred = final_balances.get('tax_deferred', 0)
    roth = final_balances.get('roth', 0)
    taxable = final_balances.get('taxable', 0)
    
    # Surplus/deficit metrics
    total_surplus = financial_summary.get('total_surplus_deficit', 0)
    avg_monthly_surplus = financial_summary.get('average_monthly_surplus_deficit', 0)
    months_in_surplus = financial_summary.get('months_in_surplus', 0)
    success_rate = (months_in_surplus / total_months * 100) if total_months > 0 else 0
    
    # Tax analysis
    total_federal_tax = sum(ts.federal_tax for ts in tax_summaries)
    total_state_tax = sum(ts.state_tax for ts in tax_summaries)
    total_taxes = total_federal_tax + total_state_tax
    
    # Calculate total income for effective tax rate
    total_income = sum(mp.total_gross_cashflow for mp in monthly_projections)
    effective_tax_rate = (total_taxes / total_income * 100) if total_income > 0 else 0
    
    # Build prompt for GPT-4
    prompt = f"""You are a Certified Financial Planner analyzing a retirement scenario. Generate a professional analysis following this EXACT structure:

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
1. **Executive Summary (2 sentences)**: State if on track and identify primary financial lever (save more, retire later, tax optimization)

2. **Strategic Observations (3 bullets)**:
   - Efficiency Gap: Analyze savings rate vs goals
   - Tax Architecture: Comment on tax bucket balance
   - Risk Reality: Interpret success rate and portfolio volatility

3. **Optimization Checklist (3 actions)**:
   - Provide specific, actionable recommendations with dollar amounts
   - Examples: "Shift $X to Roth," "Establish 2-year cash buffer," "Rebalance to 70/30"

4. **Future State Visualization**:
   - Describe life in 15 years if they follow advice vs if they don't
   - Be concrete and vivid

CONSTRAINTS:
- No fluff or boilerplate language
- Use professional CFP terminology (Sequence of Returns Risk, Tax Drag, Safe Withdrawal Rate)
- Maximum 400 words
- Format in markdown with proper headers
- Be direct and actionable

Generate the analysis now:"""

    # Call OpenAI API
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "You are a Certified Financial Planner providing professional retirement planning analysis. Be direct, specific, and actionable. Use industry terminology."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.7,
            max_tokens=800
        )
        
        analysis = response.choices[0].message.content
        return analysis
        
    except Exception as e:
        # Fallback if API fails
        return f"""# Analysis Unavailable

Unable to generate AI analysis: {str(e)}

Your projection shows:
- Portfolio growth: {portfolio_growth_pct:.1f}%
- Success rate: {success_rate:.0f}%
- Cumulative surplus: ${total_surplus:,.0f}

Please check your OpenAI API key configuration."""