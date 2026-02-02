"""
Projection engine package.

This package contains the core calculation logic for retirement projections.
It is designed to be framework-agnostic - no FastAPI or web dependencies.
"""

from .timeline import Timeline, month_is_before, month_is_after, months_between
from .income import IncomeProcessor, IncomeState
from .accounts import AccountProcessor, AccountState
from .projector import ProjectionEngine, FilingStatusTracker
from .aggregator import (
    AnnualAggregator,
    calculate_portfolio_growth,
    get_projection_summary
)

__all__ = [
    # Timeline
    "Timeline",
    "month_is_before",
    "month_is_after",
    "months_between",
    # Income
    "IncomeProcessor",
    "IncomeState",
    # Accounts
    "AccountProcessor",
    "AccountState",
    # Projection
    "ProjectionEngine",
    "FilingStatusTracker",
    # Aggregation
    "AnnualAggregator",
    "calculate_portfolio_growth",
    "get_projection_summary",
]
