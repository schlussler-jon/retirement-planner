"""
Tax calculation package.

This package implements federal, state, and Social Security taxation
for retirement planning projections.
"""

from .social_security import (
    calculate_provisional_income,
    calculate_taxable_ssa,
    get_ssa_taxation_summary,
    calculate_non_taxable_ssa,
    SSA_THRESHOLDS,
)
from .federal import (
    calculate_agi,
    calculate_taxable_income,
    calculate_federal_tax,
    calculate_effective_tax_rate,
    get_standard_deduction,
    get_tax_bracket_breakdown,
    estimate_monthly_federal_tax,
    FEDERAL_TAX_BRACKETS_2024,
    STANDARD_DEDUCTION_2024,
)
from .state import (
    calculate_state_tax,
    get_state_tax_rate,
    is_no_tax_state,
    estimate_monthly_state_tax,
    get_state_tax_summary,
)
from .calculator import (
    TaxCalculator,
    calculate_taxes_for_projection,
)

__all__ = [
    # Social Security
    "calculate_provisional_income",
    "calculate_taxable_ssa",
    "get_ssa_taxation_summary",
    "calculate_non_taxable_ssa",
    "SSA_THRESHOLDS",
    # Federal
    "calculate_agi",
    "calculate_taxable_income",
    "calculate_federal_tax",
    "calculate_effective_tax_rate",
    "get_standard_deduction",
    "get_tax_bracket_breakdown",
    "estimate_monthly_federal_tax",
    "FEDERAL_TAX_BRACKETS_2024",
    "STANDARD_DEDUCTION_2024",
    # State
    "calculate_state_tax",
    "get_state_tax_rate",
    "is_no_tax_state",
    "estimate_monthly_state_tax",
    "get_state_tax_summary",
    # Calculator
    "TaxCalculator",
    "calculate_taxes_for_projection",
]
