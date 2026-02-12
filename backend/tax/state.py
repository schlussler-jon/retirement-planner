"""
State income tax calculator.

Implements state-specific tax calculations with support for progressive brackets.
"""

from models.budget import StateTaxConfig


def calculate_progressive_tax(income: float, brackets: list) -> float:
    """
    Calculate tax using progressive brackets.
    
    Args:
        income: Taxable income
        brackets: List of (threshold, rate) tuples
        
    Returns:
        Total tax owed
    """
    if income <= 0 or not brackets:
        return 0.0
    
    tax = 0.0
    previous_threshold = 0.0
    
    for threshold, rate in brackets:
        if income <= previous_threshold:
            break
        
        # Calculate taxable amount in this bracket
        taxable_in_bracket = min(income, threshold) - previous_threshold
        tax += taxable_in_bracket * rate
        
        previous_threshold = threshold
    
    return tax


def calculate_state_tax(
    agi: float,
    residence_state: str,
    filing_status: str = 'single'
) -> float:
    """
    Calculate state income tax.
    
    Uses progressive brackets when available, otherwise uses flat rate.
    
    Args:
        agi: Adjusted Gross Income (federal AGI)
        residence_state: Two-letter state code
        filing_status: Filing status (single, married_filing_jointly, etc.)
        
    Returns:
        State income tax owed
    """
    if agi <= 0:
        return 0.0
    
    residence_state = residence_state.upper()
    
    # Check for no-tax states
    if StateTaxConfig.is_no_tax_state(residence_state):
        return 0.0
    
    # Check for progressive brackets
    if StateTaxConfig.has_progressive_brackets(residence_state):
        brackets = StateTaxConfig.get_progressive_brackets(residence_state, filing_status)
        if brackets:
            return calculate_progressive_tax(agi, brackets)
    
    # Fall back to flat rate
    rate = StateTaxConfig.get_state_rate(residence_state)
    return agi * rate


def get_state_tax_rate(residence_state: str) -> float:
    """
    Get the tax rate for a state (flat rate only).
    
    Note: This returns 0 for states with progressive brackets.
    Use calculate_state_tax() for accurate calculations.
    
    Args:
        residence_state: Two-letter state code
        
    Returns:
        Tax rate as decimal (e.g., 0.05 = 5%), or 0 for progressive states
    """
    residence_state = residence_state.upper()
    
    if StateTaxConfig.has_progressive_brackets(residence_state):
        return 0.0  # Progressive brackets - can't return single rate
    
    return StateTaxConfig.get_state_rate(residence_state)


def is_no_tax_state(residence_state: str) -> bool:
    """
    Check if a state has no income tax.
    
    Args:
        residence_state: Two-letter state code
        
    Returns:
        True if state has no income tax
    """
    return StateTaxConfig.is_no_tax_state(residence_state)


def estimate_monthly_state_tax(
    annual_tax: float,
    months_in_year: int = 12
) -> float:
    """
    Estimate monthly state tax withholding.
    
    Args:
        annual_tax: Total annual state tax
        months_in_year: Number of months (usually 12)
        
    Returns:
        Estimated monthly tax
    """
    if months_in_year <= 0:
        return 0.0
    
    return annual_tax / months_in_year


def get_state_tax_summary(
    agi: float,
    residence_state: str,
    filing_status: str = 'single'
) -> dict:
    """
    Get detailed state tax information.
    
    Args:
        agi: Adjusted Gross Income
        residence_state: Two-letter state code
        filing_status: Filing status
        
    Returns:
        Dictionary with:
        - state: State code
        - has_progressive_brackets: Whether state uses progressive brackets
        - rate: Flat tax rate (0 if progressive)
        - is_no_tax_state: Whether state has no income tax
        - taxable_income: Income subject to state tax (simplified = AGI)
        - state_tax: Tax owed
    """
    residence_state = residence_state.upper()
    has_progressive = StateTaxConfig.has_progressive_brackets(residence_state)
    rate = 0.0 if has_progressive else get_state_tax_rate(residence_state)
    tax = calculate_state_tax(agi, residence_state, filing_status)
    
    return {
        "state": residence_state,
        "has_progressive_brackets": has_progressive,
        "rate": rate,
        "is_no_tax_state": is_no_tax_state(residence_state),
        "taxable_income": agi,
        "state_tax": tax,
    }
