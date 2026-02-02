"""
Budget and net income calculation package.

This package handles budget inflation, survivor spending reduction,
and net income projections.
"""

from .inflation import (
    BudgetState,
    BudgetProcessor,
    calculate_inflation_adjusted_amount,
    estimate_lifetime_spending,
)
from .net_income import (
    NetIncomeCalculator,
    calculate_net_income_projections,
    get_financial_summary,
    get_annual_summaries,
    identify_deficit_periods,
)

__all__ = [
    # Inflation & Budget
    "BudgetState",
    "BudgetProcessor",
    "calculate_inflation_adjusted_amount",
    "estimate_lifetime_spending",
    # Net Income
    "NetIncomeCalculator",
    "calculate_net_income_projections",
    "get_financial_summary",
    "get_annual_summaries",
    "identify_deficit_periods",
]
