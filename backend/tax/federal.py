"""
Federal income tax calculator.

Implements progressive tax brackets and standard deductions
for the 2025 tax year (post One Big Beautiful Bill Act).
"""

from typing import List
from models import FilingStatus


# 2025 Federal Tax Brackets (IRS Revenue Procedure 2024-40, adjusted per OBBB)
# Format: (upper_limit, rate)
# Last bracket has upper_limit = float('inf')

FEDERAL_TAX_BRACKETS_2025 = {
    FilingStatus.SINGLE: [
        (11925, 0.10),
        (48475, 0.12),
        (103350, 0.22),
        (197300, 0.24),
        (250525, 0.32),
        (626350, 0.35),
        (float('inf'), 0.37),
    ],
    FilingStatus.MARRIED_FILING_JOINTLY: [
        (23850, 0.10),
        (96950, 0.12),
        (206700, 0.22),
        (394600, 0.24),
        (501050, 0.32),
        (751600, 0.35),
        (float('inf'), 0.37),
    ],
    FilingStatus.MARRIED_FILING_SEPARATELY: [
        (11925, 0.10),
        (48475, 0.12),
        (103350, 0.22),
        (197300, 0.24),
        (250525, 0.32),
        (375800, 0.35),
        (float('inf'), 0.37),
    ],
    FilingStatus.HEAD_OF_HOUSEHOLD: [
        (17000, 0.10),
        (64850, 0.12),
        (103350, 0.22),
        (197300, 0.24),
        (250500, 0.32),
        (626350, 0.35),
        (float('inf'), 0.37),
    ],
}


# 2025 Standard Deductions (raised by One Big Beautiful Bill Act, signed July 4 2025)
STANDARD_DEDUCTION_2025 = {
    FilingStatus.SINGLE: 15750,
    FilingStatus.MARRIED_FILING_JOINTLY: 31500,
    FilingStatus.MARRIED_FILING_SEPARATELY: 15750,
    FilingStatus.HEAD_OF_HOUSEHOLD: 23625,
}


def get_standard_deduction(filing_status: FilingStatus) -> float:
    """
    Get the 2025 standard deduction for a filing status.

    Args:
        filing_status: Tax filing status

    Returns:
        Standard deduction amount
    """
    return STANDARD_DEDUCTION_2025.get(
        filing_status,
        STANDARD_DEDUCTION_2025[FilingStatus.SINGLE]
    )


def calculate_agi(
    ordinary_income: float,
    taxable_ssa_income: float,
    capital_gains: float = 0.0,
    adjustments: float = 0.0
) -> float:
    """
    Calculate Adjusted Gross Income.

    AGI = ordinary income + taxable SSA + capital gains - adjustments

    Args:
        ordinary_income: Pensions, wages, withdrawals from tax-deferred accounts
        taxable_ssa_income: Taxable portion of Social Security
        capital_gains: Capital gains (v1: usually 0)
        adjustments: Above-the-line deductions (v1: usually 0)

    Returns:
        Adjusted Gross Income
    """
    return ordinary_income + taxable_ssa_income + capital_gains - adjustments


def calculate_taxable_income(
    agi: float,
    filing_status: FilingStatus,
) -> float:
    """
    Calculate taxable income using 2025 standard deduction.

    Taxable Income = AGI - Standard Deduction

    Args:
        agi: Adjusted Gross Income
        filing_status: Filing status

    Returns:
        Taxable income (cannot be negative)
    """
    deduction = get_standard_deduction(filing_status)
    return max(0.0, agi - deduction)


def calculate_federal_tax(
    taxable_income: float,
    filing_status: FilingStatus,
    tax_year: int = 2025  # kept for backward compatibility, always uses 2025 rules
) -> float:
    """
    Calculate federal income tax using 2025 progressive brackets.

    Args:
        taxable_income: Taxable income after deductions
        filing_status: Filing status
        tax_year: Ignored — always uses 2025 rules

    Returns:
        Total federal income tax owed

    Example:
        Single filer with $50,000 taxable income (2025):
        - First $11,925 at 10% = $1,192.50
        - Next $36,550 at 12% = $4,386
        - Remaining $1,525 at 22% = $335.50
        - Total tax = $5,914
    """
    if taxable_income <= 0:
        return 0.0

    brackets = FEDERAL_TAX_BRACKETS_2025.get(
        filing_status,
        FEDERAL_TAX_BRACKETS_2025[FilingStatus.SINGLE]
    )

    total_tax = 0.0
    previous_limit = 0.0

    for upper_limit, rate in brackets:
        if taxable_income <= previous_limit:
            break
        if taxable_income <= upper_limit:
            amount_in_bracket = taxable_income - previous_limit
        else:
            amount_in_bracket = upper_limit - previous_limit
        total_tax += amount_in_bracket * rate
        previous_limit = upper_limit

    return total_tax


def calculate_effective_tax_rate(total_tax: float, agi: float) -> float:
    """
    Calculate effective tax rate.

    Args:
        total_tax: Total tax owed
        agi: Adjusted Gross Income

    Returns:
        Effective tax rate as decimal (e.g., 0.15 = 15%)
    """
    if agi <= 0:
        return 0.0
    return total_tax / agi


def get_tax_bracket_breakdown(
    taxable_income: float,
    filing_status: FilingStatus
) -> List[dict]:
    """
    Get detailed breakdown of tax by bracket.

    Args:
        taxable_income: Taxable income
        filing_status: Filing status

    Returns:
        List of dicts with bracket_name, lower_limit, upper_limit,
        rate, amount_in_bracket, tax_in_bracket
    """
    if taxable_income <= 0:
        return []

    brackets = FEDERAL_TAX_BRACKETS_2025.get(
        filing_status,
        FEDERAL_TAX_BRACKETS_2025[FilingStatus.SINGLE]
    )

    breakdown = []
    previous_limit = 0.0

    for upper_limit, rate in brackets:
        if taxable_income <= previous_limit:
            break
        if taxable_income <= upper_limit:
            amount_in_bracket = taxable_income - previous_limit
        else:
            amount_in_bracket = upper_limit - previous_limit

        breakdown.append({
            "bracket_name": f"{int(rate * 100)}% bracket",
            "lower_limit": previous_limit,
            "upper_limit": upper_limit if upper_limit != float('inf') else None,
            "rate": rate,
            "amount_in_bracket": amount_in_bracket,
            "tax_in_bracket": amount_in_bracket * rate,
        })

        previous_limit = upper_limit

    return breakdown


def estimate_monthly_federal_tax(
    annual_tax: float,
    months_in_year: int = 12
) -> float:
    """
    Estimate monthly federal tax withholding.

    Args:
        annual_tax: Total annual federal tax
        months_in_year: Number of months (usually 12)

    Returns:
        Estimated monthly tax
    """
    if months_in_year <= 0:
        return 0.0
    return annual_tax / months_in_year
