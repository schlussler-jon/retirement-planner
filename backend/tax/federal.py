"""
Federal income tax calculator.

Implements progressive tax brackets and standard deductions
for the 2024 tax year.
"""

from typing import List, Tuple
from models import FilingStatus


# 2024 Federal Tax Brackets
# Format: (upper_limit, rate)
# Last bracket has upper_limit = float('inf')

FEDERAL_TAX_BRACKETS_2024 = {
    FilingStatus.SINGLE: [
        (11600, 0.10),
        (47150, 0.12),
        (100525, 0.22),
        (191950, 0.24),
        (243725, 0.32),
        (609350, 0.35),
        (float('inf'), 0.37),
    ],
    FilingStatus.MARRIED_FILING_JOINTLY: [
        (23200, 0.10),
        (94300, 0.12),
        (201050, 0.22),
        (383900, 0.24),
        (487450, 0.32),
        (731200, 0.35),
        (float('inf'), 0.37),
    ],
    FilingStatus.MARRIED_FILING_SEPARATELY: [
        (11600, 0.10),
        (47150, 0.12),
        (100525, 0.22),
        (191950, 0.24),
        (243725, 0.32),
        (365600, 0.35),
        (float('inf'), 0.37),
    ],
    FilingStatus.HEAD_OF_HOUSEHOLD: [
        (16550, 0.10),
        (63100, 0.12),
        (100500, 0.22),
        (191950, 0.24),
        (243700, 0.32),
        (609350, 0.35),
        (float('inf'), 0.37),
    ],
}


# 2024 Standard Deductions
STANDARD_DEDUCTION_2024 = {
    FilingStatus.SINGLE: 14600,
    FilingStatus.MARRIED_FILING_JOINTLY: 29200,
    FilingStatus.MARRIED_FILING_SEPARATELY: 14600,
    FilingStatus.HEAD_OF_HOUSEHOLD: 21900,
}


def get_standard_deduction(
    filing_status: FilingStatus,
    override: float = None
) -> float:
    """
    Get standard deduction for a filing status.
    
    Args:
        filing_status: Tax filing status
        override: Optional override amount
        
    Returns:
        Standard deduction amount
    """
    if override is not None:
        return override
    
    return STANDARD_DEDUCTION_2024.get(
        filing_status,
        STANDARD_DEDUCTION_2024[FilingStatus.SINGLE]
    )


def calculate_agi(
    ordinary_income: float,
    taxable_ssa_income: float,
    capital_gains: float = 0.0,
    adjustments: float = 0.0
) -> float:
    """
    Calculate Adjusted Gross Income.
    
    AGI = All income - above-the-line adjustments
    
    In v1, we simplify:
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
    standard_deduction_override: float = None
) -> float:
    """
    Calculate taxable income.
    
    Taxable Income = AGI - Standard Deduction
    
    Args:
        agi: Adjusted Gross Income
        filing_status: Filing status
        standard_deduction_override: Optional override for standard deduction
        
    Returns:
        Taxable income (cannot be negative)
    """
    deduction = get_standard_deduction(filing_status, standard_deduction_override)
    taxable = agi - deduction
    
    # Taxable income cannot be negative
    return max(0.0, taxable)


def calculate_federal_tax(
    taxable_income: float,
    filing_status: FilingStatus,
    tax_year: int = 2024
) -> float:
    """
    Calculate federal income tax using progressive brackets.
    
    Progressive taxation means:
    - First portion taxed at 10%
    - Next portion taxed at 12%
    - And so on...
    
    Args:
        taxable_income: Taxable income after deductions
        filing_status: Filing status
        tax_year: Tax year for bracket rules (default 2024)
        
    Returns:
        Total federal income tax owed
        
    Example:
        Single filer with $50,000 taxable income (2024):
        - First $11,600 at 10% = $1,160
        - Next $35,550 at 12% = $4,266
        - Remaining $2,850 at 22% = $627
        - Total tax = $6,053
    """
    if taxable_income <= 0:
        return 0.0
    
    # Get brackets for filing status
    # For now, we only support 2024
    brackets = FEDERAL_TAX_BRACKETS_2024.get(
        filing_status,
        FEDERAL_TAX_BRACKETS_2024[FilingStatus.SINGLE]
    )
    
    total_tax = 0.0
    previous_limit = 0.0
    
    for upper_limit, rate in brackets:
        # How much income falls in this bracket?
        if taxable_income <= previous_limit:
            # No income in this bracket
            break
        
        if taxable_income <= upper_limit:
            # Partial bracket - only goes up to taxable_income
            amount_in_bracket = taxable_income - previous_limit
        else:
            # Full bracket
            amount_in_bracket = upper_limit - previous_limit
        
        # Calculate tax for this bracket
        tax_in_bracket = amount_in_bracket * rate
        total_tax += tax_in_bracket
        
        # Move to next bracket
        previous_limit = upper_limit
    
    return total_tax


def calculate_effective_tax_rate(
    total_tax: float,
    agi: float
) -> float:
    """
    Calculate effective tax rate.
    
    Effective Rate = Total Tax / AGI
    
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
    
    Useful for displaying to users or debugging.
    
    Args:
        taxable_income: Taxable income
        filing_status: Filing status
        
    Returns:
        List of dictionaries, one per bracket with:
        - bracket_name: Description (e.g., "10% bracket")
        - lower_limit: Start of bracket
        - upper_limit: End of bracket
        - rate: Tax rate
        - amount_in_bracket: How much income in this bracket
        - tax_in_bracket: Tax owed for this bracket
    """
    if taxable_income <= 0:
        return []
    
    brackets = FEDERAL_TAX_BRACKETS_2024.get(
        filing_status,
        FEDERAL_TAX_BRACKETS_2024[FilingStatus.SINGLE]
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
        
        tax_in_bracket = amount_in_bracket * rate
        
        bracket_info = {
            "bracket_name": f"{int(rate * 100)}% bracket",
            "lower_limit": previous_limit,
            "upper_limit": upper_limit if upper_limit != float('inf') else None,
            "rate": rate,
            "amount_in_bracket": amount_in_bracket,
            "tax_in_bracket": tax_in_bracket,
        }
        
        breakdown.append(bracket_info)
        previous_limit = upper_limit
    
    return breakdown


def estimate_monthly_federal_tax(
    annual_tax: float,
    months_in_year: int = 12
) -> float:
    """
    Estimate monthly federal tax withholding.
    
    Simply divides annual tax by number of months.
    
    Args:
        annual_tax: Total annual federal tax
        months_in_year: Number of months (usually 12)
        
    Returns:
        Estimated monthly tax
    """
    if months_in_year <= 0:
        return 0.0
    
    return annual_tax / months_in_year
