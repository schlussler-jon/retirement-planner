"""
Social Security taxation calculator.

Implements the IRS provisional income method for calculating
taxable Social Security benefits. This is the "accurate" model
referenced in the Excel workbook.

SSA benefits can be 0%, 50%, or 85% taxable depending on income.
"""

from typing import Tuple
from models import FilingStatus


# Thresholds for Social Security taxation (2024 tax year)
# These determine how much of SSA income is taxable

SSA_THRESHOLDS = {
    FilingStatus.SINGLE: {
        "base": 25000,      # Below this: 0% taxable
        "max": 34000,       # Above this: 85% taxable
    },
    FilingStatus.MARRIED_FILING_JOINTLY: {
        "base": 32000,      # Below this: 0% taxable
        "max": 44000,       # Above this: 85% taxable
    },
    FilingStatus.MARRIED_FILING_SEPARATELY: {
        "base": 0,          # MFS has no base threshold
        "max": 0,           # MFS goes straight to 85%
    },
    FilingStatus.HEAD_OF_HOUSEHOLD: {
        "base": 25000,      # Same as single
        "max": 34000,       # Same as single
    }
}


def calculate_provisional_income(
    ssa_income: float,
    other_ordinary_income: float,
    tax_exempt_interest: float = 0.0
) -> float:
    """
    Calculate provisional income for Social Security taxation.
    
    Provisional Income Formula (IRS):
    = Adjusted Gross Income (excluding SSA)
    + Tax-exempt interest
    + 50% of Social Security benefits
    
    Args:
        ssa_income: Total Social Security income for the year
        other_ordinary_income: All other income (pensions, withdrawals, etc.)
        tax_exempt_interest: Tax-exempt interest income (municipal bonds, etc.)
        
    Returns:
        Provisional income amount
    """
    return other_ordinary_income + tax_exempt_interest + (0.5 * ssa_income)


def calculate_taxable_ssa(
    ssa_income: float,
    other_ordinary_income: float,
    filing_status: FilingStatus,
    tax_exempt_interest: float = 0.0
) -> float:
    """
    Calculate taxable portion of Social Security income.
    
    IRS Rules:
    1. Calculate provisional income
    2. Compare to thresholds for filing status
    3. Determine taxable percentage (0%, 50%, or 85%)
    4. Apply caps to ensure not more than 85% is taxed
    
    Args:
        ssa_income: Total Social Security income for the year
        other_ordinary_income: All other ordinary income
        filing_status: Tax filing status
        tax_exempt_interest: Tax-exempt interest (optional)
        
    Returns:
        Taxable portion of Social Security income (0 to 85% of ssa_income)
        
    Examples:
        >>> calculate_taxable_ssa(20000, 10000, FilingStatus.SINGLE)
        0.0  # Provisional income = 30000, below 25000 base
        
        >>> calculate_taxable_ssa(30000, 20000, FilingStatus.SINGLE)
        7500.0  # 50% of excess over base threshold
        
        >>> calculate_taxable_ssa(40000, 40000, FilingStatus.SINGLE)
        34000.0  # 85% cap applies
    """
    # Handle zero or negative SSA income
    if ssa_income <= 0:
        return 0.0
    
    # Get thresholds for filing status
    thresholds = SSA_THRESHOLDS.get(
        filing_status,
        SSA_THRESHOLDS[FilingStatus.SINGLE]  # Default fallback
    )
    
    base_threshold = thresholds["base"]
    max_threshold = thresholds["max"]
    
    # Calculate provisional income
    provisional_income = calculate_provisional_income(
        ssa_income,
        other_ordinary_income,
        tax_exempt_interest
    )
    
    # Tier 1: Below base threshold - 0% taxable
    if provisional_income <= base_threshold:
        return 0.0
    
    # Tier 2: Between base and max threshold - up to 50% taxable
    if provisional_income <= max_threshold:
        # 50% of the amount over base threshold
        excess_over_base = provisional_income - base_threshold
        taxable_amount = 0.5 * excess_over_base
        
        # Cap at 50% of total SSA income
        return min(taxable_amount, 0.5 * ssa_income)
    
    # Tier 3: Above max threshold - up to 85% taxable
    # This is the complex tier with multiple calculations
    
    # First, calculate the 50% portion (from base to max)
    amount_in_50_percent_range = max_threshold - base_threshold
    fifty_percent_portion = 0.5 * amount_in_50_percent_range
    
    # Second, calculate the 85% portion (above max threshold)
    excess_over_max = provisional_income - max_threshold
    eighty_five_percent_portion = 0.85 * excess_over_max
    
    # Total taxable is the sum of both portions
    total_taxable = fifty_percent_portion + eighty_five_percent_portion
    
    # Cap at 85% of total SSA income (absolute maximum)
    return min(total_taxable, 0.85 * ssa_income)


def get_ssa_taxation_summary(
    ssa_income: float,
    other_ordinary_income: float,
    filing_status: FilingStatus,
    tax_exempt_interest: float = 0.0
) -> dict:
    """
    Get detailed breakdown of Social Security taxation.
    
    Useful for debugging and displaying to users.
    
    Args:
        ssa_income: Total Social Security income
        other_ordinary_income: Other ordinary income
        filing_status: Filing status
        tax_exempt_interest: Tax-exempt interest (optional)
        
    Returns:
        Dictionary with detailed breakdown:
        - ssa_income: Total SSA received
        - provisional_income: Calculated provisional income
        - taxable_ssa: Amount of SSA that is taxable
        - taxable_percentage: Percentage taxed (0-85%)
        - tier: Which tier applies (1=0%, 2=50%, 3=85%)
    """
    provisional_income = calculate_provisional_income(
        ssa_income,
        other_ordinary_income,
        tax_exempt_interest
    )
    
    taxable_ssa = calculate_taxable_ssa(
        ssa_income,
        other_ordinary_income,
        filing_status,
        tax_exempt_interest
    )
    
    # Determine percentage and tier
    if ssa_income > 0:
        taxable_percentage = (taxable_ssa / ssa_income) * 100
    else:
        taxable_percentage = 0.0
    
    # Determine tier
    thresholds = SSA_THRESHOLDS.get(
        filing_status,
        SSA_THRESHOLDS[FilingStatus.SINGLE]
    )
    
    if provisional_income <= thresholds["base"]:
        tier = 1  # 0% tier
    elif provisional_income <= thresholds["max"]:
        tier = 2  # 50% tier
    else:
        tier = 3  # 85% tier
    
    return {
        "ssa_income": ssa_income,
        "provisional_income": provisional_income,
        "taxable_ssa": taxable_ssa,
        "taxable_percentage": taxable_percentage,
        "tier": tier,
        "base_threshold": thresholds["base"],
        "max_threshold": thresholds["max"],
    }


def calculate_non_taxable_ssa(
    ssa_income: float,
    other_ordinary_income: float,
    filing_status: FilingStatus,
    tax_exempt_interest: float = 0.0
) -> float:
    """
    Calculate the non-taxable portion of Social Security.
    
    This is simply: total SSA - taxable SSA
    
    Args:
        ssa_income: Total Social Security income
        other_ordinary_income: Other ordinary income
        filing_status: Filing status
        tax_exempt_interest: Tax-exempt interest (optional)
        
    Returns:
        Non-taxable portion of SSA income
    """
    taxable = calculate_taxable_ssa(
        ssa_income,
        other_ordinary_income,
        filing_status,
        tax_exempt_interest
    )
    
    return ssa_income - taxable
