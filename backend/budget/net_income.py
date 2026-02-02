"""
Net income projection calculator.

Combines income, taxes, and spending to calculate net income
and surplus/deficit projections.
"""

from typing import List, Dict
from models import (
    MonthlyProjection,
    TaxSummary,
    NetIncomeProjection,
)


class NetIncomeCalculator:
    """
    Calculates net income projections.
    
    Net Income = Gross Income - Taxes
    Surplus/Deficit = Net Income - Spending
    """
    
    def __init__(self, tax_summaries: List[TaxSummary]):
        """
        Initialize calculator with tax information.
        
        Args:
            tax_summaries: List of annual tax summaries
        """
        self.tax_summaries = tax_summaries
        
        # Build lookup for monthly tax estimates
        self.monthly_tax_estimates: Dict[str, tuple] = {}
        self._build_monthly_tax_estimates()
    
    def _build_monthly_tax_estimates(self) -> None:
        """
        Create monthly tax estimates from annual summaries.
        
        Simply divides annual tax by 12 for each month of each year.
        """
        for tax_summary in self.tax_summaries:
            year = tax_summary.year
            
            # Monthly estimates (annual / 12)
            monthly_federal = tax_summary.federal_tax / 12
            monthly_state = tax_summary.state_tax / 12
            monthly_total = tax_summary.total_tax / 12
            
            # Store for all 12 months of this year
            for month in range(1, 13):
                year_month = f"{year:04d}-{month:02d}"
                self.monthly_tax_estimates[year_month] = (
                    monthly_federal,
                    monthly_state,
                    monthly_total
                )
    
    def get_monthly_tax_estimate(self, year_month: str) -> tuple:
        """
        Get estimated monthly tax for a specific month.
        
        Args:
            year_month: Month in YYYY-MM format
            
        Returns:
            Tuple of (federal_tax, state_tax, total_tax)
        """
        return self.monthly_tax_estimates.get(
            year_month,
            (0.0, 0.0, 0.0)
        )
    
    def calculate_net_income(
        self,
        gross_cashflow: float,
        estimated_monthly_tax: float
    ) -> float:
        """
        Calculate net income after taxes.
        
        Net Income = Gross Cashflow - Estimated Taxes
        
        Args:
            gross_cashflow: Total gross income/cashflow
            estimated_monthly_tax: Estimated monthly tax
            
        Returns:
            Net income after taxes
        """
        return gross_cashflow - estimated_monthly_tax
    
    def calculate_surplus_deficit(
        self,
        net_income: float,
        spending: float
    ) -> float:
        """
        Calculate surplus or deficit.
        
        Surplus/Deficit = Net Income - Spending
        
        Positive = Surplus (saving money)
        Negative = Deficit (spending more than income)
        
        Args:
            net_income: Net income after taxes
            spending: Monthly spending amount
            
        Returns:
            Surplus (positive) or deficit (negative)
        """
        return net_income - spending
    
    def create_projection(
        self,
        monthly_projection: MonthlyProjection,
        monthly_spending: float
    ) -> NetIncomeProjection:
        """
        Create net income projection for a month.
        
        Args:
            monthly_projection: Monthly projection with income/withdrawals
            monthly_spending: Spending for this month
            
        Returns:
            NetIncomeProjection with complete financial picture
        """
        # Get tax estimates for this month
        federal_tax, state_tax, total_tax = self.get_monthly_tax_estimate(
            monthly_projection.month
        )
        
        # Calculate net income
        gross_cashflow = monthly_projection.total_gross_cashflow
        net_income = self.calculate_net_income(gross_cashflow, total_tax)
        
        # Calculate surplus/deficit
        surplus_deficit = self.calculate_surplus_deficit(
            net_income,
            monthly_spending
        )
        
        # Inflation-adjusted spending is just the spending
        # (already inflation-adjusted by BudgetProcessor)
        inflation_adjusted_spending = monthly_spending
        
        return NetIncomeProjection(
            month=monthly_projection.month,
            gross_cashflow=gross_cashflow,
            estimated_federal_tax=federal_tax,
            estimated_state_tax=state_tax,
            estimated_total_tax=total_tax,
            net_income_after_tax=net_income,
            inflation_adjusted_spending=inflation_adjusted_spending,
            surplus_deficit=surplus_deficit
        )


def calculate_net_income_projections(
    monthly_projections: List[MonthlyProjection],
    tax_summaries: List[TaxSummary],
    monthly_spending_amounts: List[float]
) -> List[NetIncomeProjection]:
    """
    Calculate complete net income projections.
    
    Args:
        monthly_projections: Monthly projection results from engine
        tax_summaries: Annual tax summaries
        monthly_spending_amounts: Spending amount for each month
        
    Returns:
        List of NetIncomeProjection objects, one per month
    """
    if len(monthly_projections) != len(monthly_spending_amounts):
        raise ValueError(
            f"Mismatch: {len(monthly_projections)} projections "
            f"but {len(monthly_spending_amounts)} spending amounts"
        )
    
    calculator = NetIncomeCalculator(tax_summaries)
    
    net_income_projections = []
    
    for monthly_proj, spending in zip(monthly_projections, monthly_spending_amounts):
        net_proj = calculator.create_projection(monthly_proj, spending)
        net_income_projections.append(net_proj)
    
    return net_income_projections


def get_financial_summary(
    net_income_projections: List[NetIncomeProjection]
) -> Dict[str, float]:
    """
    Generate summary statistics from net income projections.
    
    Args:
        net_income_projections: List of monthly net income projections
        
    Returns:
        Dictionary with summary statistics:
        - total_gross_income
        - total_taxes
        - total_spending
        - total_surplus_deficit
        - average_monthly_surplus_deficit
        - months_in_surplus
        - months_in_deficit
    """
    if not net_income_projections:
        return {}
    
    total_gross = sum(p.gross_cashflow for p in net_income_projections)
    total_taxes = sum(p.estimated_total_tax for p in net_income_projections)
    total_spending = sum(p.inflation_adjusted_spending for p in net_income_projections)
    total_surplus_deficit = sum(p.surplus_deficit for p in net_income_projections)
    
    months_in_surplus = sum(1 for p in net_income_projections if p.surplus_deficit > 0)
    months_in_deficit = sum(1 for p in net_income_projections if p.surplus_deficit < 0)
    
    total_months = len(net_income_projections)
    avg_monthly_surplus = total_surplus_deficit / total_months if total_months > 0 else 0
    
    return {
        "total_gross_income": total_gross,
        "total_taxes": total_taxes,
        "total_spending": total_spending,
        "total_surplus_deficit": total_surplus_deficit,
        "average_monthly_surplus_deficit": avg_monthly_surplus,
        "months_in_surplus": months_in_surplus,
        "months_in_deficit": months_in_deficit,
        "total_months": total_months,
    }


def get_annual_summaries(
    net_income_projections: List[NetIncomeProjection]
) -> List[Dict[str, any]]:
    """
    Group net income projections by year.
    
    Args:
        net_income_projections: List of monthly projections
        
    Returns:
        List of dictionaries, one per year, with annual totals
    """
    by_year: Dict[int, List[NetIncomeProjection]] = {}
    
    for projection in net_income_projections:
        year = int(projection.month.split('-')[0])
        if year not in by_year:
            by_year[year] = []
        by_year[year].append(projection)
    
    annual_summaries = []
    
    for year in sorted(by_year.keys()):
        year_projections = by_year[year]
        
        summary = {
            "year": year,
            "total_gross_income": sum(p.gross_cashflow for p in year_projections),
            "total_taxes": sum(p.estimated_total_tax for p in year_projections),
            "total_net_income": sum(p.net_income_after_tax for p in year_projections),
            "total_spending": sum(p.inflation_adjusted_spending for p in year_projections),
            "total_surplus_deficit": sum(p.surplus_deficit for p in year_projections),
            "average_monthly_surplus": sum(p.surplus_deficit for p in year_projections) / len(year_projections),
        }
        
        annual_summaries.append(summary)
    
    return annual_summaries


def identify_deficit_periods(
    net_income_projections: List[NetIncomeProjection],
    consecutive_months: int = 3
) -> List[Dict[str, any]]:
    """
    Identify periods of sustained deficit.
    
    Useful for flagging potential financial problems.
    
    Args:
        net_income_projections: List of monthly projections
        consecutive_months: Minimum consecutive months to flag
        
    Returns:
        List of deficit periods with start/end months and total deficit
    """
    deficit_periods = []
    current_period = None
    
    for projection in net_income_projections:
        if projection.surplus_deficit < 0:
            # In deficit
            if current_period is None:
                # Start new period
                current_period = {
                    "start_month": projection.month,
                    "end_month": projection.month,
                    "total_deficit": projection.surplus_deficit,
                    "months": 1,
                }
            else:
                # Continue current period
                current_period["end_month"] = projection.month
                current_period["total_deficit"] += projection.surplus_deficit
                current_period["months"] += 1
        else:
            # Not in deficit
            if current_period and current_period["months"] >= consecutive_months:
                # Save period if it meets minimum length
                deficit_periods.append(current_period)
            current_period = None
    
    # Check final period
    if current_period and current_period["months"] >= consecutive_months:
        deficit_periods.append(current_period)
    
    return deficit_periods
