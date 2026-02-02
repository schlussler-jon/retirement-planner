"""
State income tax calculator.

Implements state-specific tax calculations.
V1 uses simplified flat rates for most states.
"""

from models.budget import StateTaxConfig


def calculate_state_tax(
    agi: float,
    residence_state: str,
    filing_status: str = None
) -> float:
    """
    Calculate state income tax.
    
    V1 Implementation:
    - Uses flat rates from StateTaxConfig
    - No-tax states return 0
    - States without specific rates use 5% fallback
    
    V2 TODO:
    - Progressive brackets for states like CA
    - State-specific deductions
    - Special calculations for states like PA (no retirement income tax)
    
    Args:
        agi: Adjusted Gross Income (federal AGI)
        residence_state: Two-letter state code
        filing_status: Filing status (not used in v1, but available for v2)
        
    Returns:
        State income tax owed
    """
    if agi <= 0:
        return 0.0
    
    # Get state tax rate
    rate = StateTaxConfig.get_state_rate(residence_state)
    
    # Simple flat rate calculation
    return agi * rate


def get_state_tax_rate(residence_state: str) -> float:
    """
    Get the tax rate for a state.
    
    Args:
        residence_state: Two-letter state code
        
    Returns:
        Tax rate as decimal (e.g., 0.05 = 5%)
    """
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
    filing_status: str = None
) -> dict:
    """
    Get detailed state tax information.
    
    Args:
        agi: Adjusted Gross Income
        residence_state: Two-letter state code
        filing_status: Filing status (optional)
        
    Returns:
        Dictionary with:
        - state: State code
        - rate: Tax rate
        - is_no_tax_state: Whether state has no income tax
        - taxable_income: Income subject to state tax (simplified = AGI)
        - state_tax: Tax owed
    """
    rate = get_state_tax_rate(residence_state)
    tax = calculate_state_tax(agi, residence_state, filing_status)
    
    return {
        "state": residence_state.upper(),
        "rate": rate,
        "is_no_tax_state": is_no_tax_state(residence_state),
        "taxable_income": agi,
        "state_tax": tax,
    }
