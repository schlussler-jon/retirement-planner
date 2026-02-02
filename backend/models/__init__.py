"""
Retirement planning data models.

This package contains all Pydantic models for inputs and outputs.
"""

from .core import (
    Person,
    IncomeStream,
    InvestmentAccount,
    GlobalSettings,
    TaxBucket,
    IncomeStreamType,
)
from .budget import (
    BudgetCategory,
    BudgetSettings,
    TaxSettings,
    FilingStatus,
    CategoryType,
    SurvivorReductionMode,
    StateTaxConfig,
)
from .outputs import (
    MonthlyProjection,
    AnnualSummary,
    TaxSummary,
    NetIncomeProjection,
    ProjectionResults,
)
from .scenario import Scenario

__all__ = [
    # Core
    "Person",
    "IncomeStream",
    "InvestmentAccount",
    "GlobalSettings",
    "TaxBucket",
    "IncomeStreamType",
    # Budget & Tax
    "BudgetCategory",
    "BudgetSettings",
    "TaxSettings",
    "FilingStatus",
    "CategoryType",
    "SurvivorReductionMode",
    "StateTaxConfig",
    # Outputs
    "MonthlyProjection",
    "AnnualSummary",
    "TaxSummary",
    "NetIncomeProjection",
    "ProjectionResults",
    # Scenario
    "Scenario",
]
