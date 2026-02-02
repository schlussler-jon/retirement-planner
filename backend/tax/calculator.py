"""
Main tax calculator.

Integrates Social Security taxation, federal tax, and state tax
into a unified calculator that works with projection results.
"""

from typing import List, Dict
from models import (
    MonthlyProjection,
    TaxSummary,
    FilingStatus,
    IncomeStreamType,
)
from .social_security import calculate_taxable_ssa, get_ssa_taxation_summary
from .federal import (
    calculate_agi,
    calculate_taxable_income,
    calculate_federal_tax,
    calculate_effective_tax_rate,
    get_standard_deduction,
)
from .state import calculate_state_tax, get_state_tax_rate


class TaxCalculator:
    """
    Unified tax calculator for retirement projections.
    
    Calculates:
    - Social Security taxation
    - Federal income tax
    - State income tax
    - Monthly tax estimates
    """
    
    def __init__(
        self,
        filing_status: FilingStatus,
        residence_state: str,
        standard_deduction_override: float = None,
        tax_year: int = 2024
    ):
        """
        Initialize tax calculator.
        
        Args:
            filing_status: Tax filing status
            residence_state: Two-letter state code
            standard_deduction_override: Optional override for standard deduction
            tax_year: Tax year for rules (default 2024)
        """
        self.filing_status = filing_status
        self.residence_state = residence_state
        self.standard_deduction_override = standard_deduction_override
        self.tax_year = tax_year
    
    def calculate_annual_taxes(
        self,
        annual_ssa_income: float,
        annual_other_income: float,
        tax_exempt_interest: float = 0.0
    ) -> TaxSummary:
        """
        Calculate all taxes for a year.
        
        Args:
            annual_ssa_income: Total Social Security for the year
            annual_other_income: All other ordinary income (pensions, withdrawals)
            tax_exempt_interest: Tax-exempt interest (optional)
            
        Returns:
            TaxSummary with complete tax calculation
        """
        # Calculate taxable SSA
        taxable_ssa = calculate_taxable_ssa(
            annual_ssa_income,
            annual_other_income,
            self.filing_status,
            tax_exempt_interest
        )
        
        # Calculate AGI
        agi = calculate_agi(
            annual_other_income,
            taxable_ssa,
            capital_gains=0.0,
            adjustments=0.0
        )
        
        # Get standard deduction
        standard_deduction = get_standard_deduction(
            self.filing_status,
            self.standard_deduction_override
        )
        
        # Calculate taxable income
        taxable_income = calculate_taxable_income(
            agi,
            self.filing_status,
            self.standard_deduction_override
        )
        
        # Calculate federal tax
        federal_tax = calculate_federal_tax(
            taxable_income,
            self.filing_status,
            self.tax_year
        )
        
        # Calculate state tax
        state_tax = calculate_state_tax(
            agi,
            self.residence_state
        )
        
        # Total tax and effective rate
        total_tax = federal_tax + state_tax
        effective_rate = calculate_effective_tax_rate(total_tax, agi)
        
        # Create TaxSummary
        # Note: year will be set by caller
        return TaxSummary(
            year=0,  # Placeholder, set by caller
            total_ssa_income=annual_ssa_income,
            taxable_ssa_income=taxable_ssa,
            other_ordinary_income=annual_other_income,
            agi=agi,
            standard_deduction=standard_deduction,
            taxable_income=taxable_income,
            federal_tax=federal_tax,
            state_tax=state_tax,
            total_tax=total_tax,
            effective_tax_rate=effective_rate
        )
    
    def calculate_taxes_from_monthly_projections(
        self,
        monthly_projections: List[MonthlyProjection],
        income_streams: list
    ) -> List[TaxSummary]:
        """
        Calculate taxes for all years in a projection.
        
        Groups monthly projections by year, calculates annual taxes.
        
        Args:
            monthly_projections: List of monthly projection results
            income_streams: List of IncomeStream objects (to identify SSA)
            
        Returns:
            List of TaxSummary objects, one per year
        """
        # Identify SSA stream IDs
        ssa_stream_ids = {
            stream.stream_id
            for stream in income_streams
            if stream.type == IncomeStreamType.SOCIAL_SECURITY
        }
        
        # Group projections by year
        by_year: Dict[int, List[MonthlyProjection]] = {}
        
        for projection in monthly_projections:
            year = int(projection.month.split('-')[0])
            if year not in by_year:
                by_year[year] = []
            by_year[year].append(projection)
        
        # Calculate taxes for each year
        tax_summaries = []
        
        for year in sorted(by_year.keys()):
            year_projections = by_year[year]
            
            # Sum SSA income for the year
            annual_ssa_income = 0.0
            for projection in year_projections:
                for stream_id, amount in projection.income_by_stream.items():
                    if stream_id in ssa_stream_ids:
                        annual_ssa_income += amount
            
            # Sum other income (non-SSA income + withdrawals)
            annual_other_income = 0.0
            for projection in year_projections:
                # Non-SSA income
                for stream_id, amount in projection.income_by_stream.items():
                    if stream_id not in ssa_stream_ids:
                        annual_other_income += amount
                
                # Withdrawals from accounts (all are ordinary income in v1)
                annual_other_income += sum(projection.withdrawals_by_account.values())
            
            # Update filing status if changed (due to death)
            # Use the filing status from the last month of the year
            last_month = year_projections[-1]
            if last_month.filing_status:
                year_filing_status = FilingStatus(last_month.filing_status)
            else:
                year_filing_status = self.filing_status
            
            # Temporarily update filing status for this year
            original_status = self.filing_status
            self.filing_status = year_filing_status
            
            # Calculate taxes
            tax_summary = self.calculate_annual_taxes(
                annual_ssa_income,
                annual_other_income
            )
            
            # Restore original filing status
            self.filing_status = original_status
            
            # Set the year
            tax_summary.year = year
            
            tax_summaries.append(tax_summary)
        
        return tax_summaries
    
    def estimate_monthly_taxes(
        self,
        annual_federal_tax: float,
        annual_state_tax: float,
        months_in_year: int = 12
    ) -> tuple[float, float]:
        """
        Estimate monthly tax withholding amounts.
        
        Args:
            annual_federal_tax: Total annual federal tax
            annual_state_tax: Total annual state tax
            months_in_year: Number of months (usually 12)
            
        Returns:
            Tuple of (monthly_federal, monthly_state)
        """
        monthly_federal = annual_federal_tax / months_in_year
        monthly_state = annual_state_tax / months_in_year
        
        return monthly_federal, monthly_state


def calculate_taxes_for_projection(
    monthly_projections: List[MonthlyProjection],
    income_streams: list,
    filing_status: FilingStatus,
    residence_state: str,
    standard_deduction_override: float = None
) -> List[TaxSummary]:
    """
    Convenience function to calculate taxes for a projection.
    
    Args:
        monthly_projections: Monthly projection results
        income_streams: List of IncomeStream objects
        filing_status: Tax filing status
        residence_state: Two-letter state code
        standard_deduction_override: Optional deduction override
        
    Returns:
        List of TaxSummary objects, one per year
    """
    calculator = TaxCalculator(
        filing_status,
        residence_state,
        standard_deduction_override
    )
    
    return calculator.calculate_taxes_from_monthly_projections(
        monthly_projections,
        income_streams
    )
