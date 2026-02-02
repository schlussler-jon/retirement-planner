"""
Annual aggregation and rollup calculations.

Takes monthly projections and creates annual summaries.
"""

from typing import List, Dict
from models import MonthlyProjection, AnnualSummary


class AnnualAggregator:
    """
    Aggregates monthly projections into annual summaries.
    
    This creates the year-by-year view that corresponds to the
    "Annual Income Investment Summary" sheet in the Excel workbook.
    """
    
    def __init__(self, monthly_projections: List[MonthlyProjection]):
        """
        Initialize aggregator with monthly data.
        
        Args:
            monthly_projections: List of monthly projection results
        """
        self.monthly_projections = monthly_projections
    
    def aggregate(self) -> List[AnnualSummary]:
        """
        Create annual summaries from monthly data.
        
        For each year in the projection:
        - Sum all gross cashflow (income + withdrawals)
        - Take the end-of-year (December) investment balance
        
        Returns:
            List of AnnualSummary objects, one per year
        """
        if not self.monthly_projections:
            return []
        
        # Group monthly projections by year
        by_year: Dict[int, List[MonthlyProjection]] = {}
        
        for projection in self.monthly_projections:
            year = int(projection.month.split('-')[0])
            
            if year not in by_year:
                by_year[year] = []
            by_year[year].append(projection)
        
        # Create annual summaries
        summaries: List[AnnualSummary] = []
        
        for year in sorted(by_year.keys()):
            year_projections = by_year[year]
            
            # Sum all income for the year
            total_income_year = sum(
                proj.total_gross_cashflow 
                for proj in year_projections
            )
            
            # Get end-of-year balance (December or last month of year)
            end_of_year_projection = year_projections[-1]
            end_of_year_investments = end_of_year_projection.total_investments
            
            summary = AnnualSummary(
                year=year,
                total_income_year=total_income_year,
                end_of_year_total_investments=end_of_year_investments
            )
            
            summaries.append(summary)
        
        return summaries
    
    def get_year_data(self, year: int) -> List[MonthlyProjection]:
        """
        Get all monthly projections for a specific year.
        
        Args:
            year: Year to retrieve
            
        Returns:
            List of MonthlyProjection objects for that year
        """
        return [
            proj for proj in self.monthly_projections
            if int(proj.month.split('-')[0]) == year
        ]
    
    def get_total_income_by_year(self) -> Dict[int, float]:
        """
        Get total income for each year.
        
        Returns:
            Dictionary mapping year to total income
        """
        by_year: Dict[int, float] = {}
        
        for projection in self.monthly_projections:
            year = int(projection.month.split('-')[0])
            
            if year not in by_year:
                by_year[year] = 0.0
            
            by_year[year] += projection.total_gross_cashflow
        
        return by_year
    
    def get_end_of_year_balances(self) -> Dict[int, float]:
        """
        Get end-of-year investment balances for each year.
        
        Returns:
            Dictionary mapping year to end-of-year balance
        """
        balances: Dict[int, float] = {}
        
        # Group by year and take last month
        by_year: Dict[int, MonthlyProjection] = {}
        
        for projection in self.monthly_projections:
            year = int(projection.month.split('-')[0])
            by_year[year] = projection  # Last one wins (December)
        
        for year, projection in by_year.items():
            balances[year] = projection.total_investments
        
        return balances
    
    def calculate_average_annual_return(self) -> float:
        """
        Calculate average annual return across the entire projection.
        
        This is useful for reporting/validation.
        
        Returns:
            Average annual return as decimal (e.g., 0.06 = 6%)
        """
        if len(self.monthly_projections) < 2:
            return 0.0
        
        start_balance = self.monthly_projections[0].total_investments
        end_balance = self.monthly_projections[-1].total_investments
        
        # Calculate number of years
        start_year = int(self.monthly_projections[0].month.split('-')[0])
        end_year = int(self.monthly_projections[-1].month.split('-')[0])
        num_years = end_year - start_year
        
        if num_years == 0 or start_balance == 0:
            return 0.0
        
        # Calculate annualized return
        # This is a simplified calculation that doesn't account for cashflows
        return (end_balance / start_balance) ** (1 / num_years) - 1


def calculate_portfolio_growth(
    monthly_projections: List[MonthlyProjection]
) -> Dict[str, float]:
    """
    Calculate portfolio growth metrics.
    
    Args:
        monthly_projections: List of monthly projections
        
    Returns:
        Dictionary with growth metrics:
        - starting_balance
        - ending_balance
        - total_growth
        - growth_percentage
    """
    if not monthly_projections:
        return {
            "starting_balance": 0.0,
            "ending_balance": 0.0,
            "total_growth": 0.0,
            "growth_percentage": 0.0
        }
    
    starting_balance = monthly_projections[0].total_investments
    ending_balance = monthly_projections[-1].total_investments
    total_growth = ending_balance - starting_balance
    
    if starting_balance > 0:
        growth_percentage = (total_growth / starting_balance) * 100
    else:
        growth_percentage = 0.0
    
    return {
        "starting_balance": starting_balance,
        "ending_balance": ending_balance,
        "total_growth": total_growth,
        "growth_percentage": growth_percentage
    }


def get_projection_summary(
    monthly_projections: List[MonthlyProjection]
) -> Dict[str, any]:
    """
    Generate a high-level summary of the projection.
    
    Args:
        monthly_projections: List of monthly projections
        
    Returns:
        Dictionary with summary statistics
    """
    if not monthly_projections:
        return {}
    
    total_months = len(monthly_projections)
    total_income = sum(p.total_gross_cashflow for p in monthly_projections)
    avg_monthly_income = total_income / total_months if total_months > 0 else 0
    
    final_projection = monthly_projections[-1]
    
    return {
        "total_months": total_months,
        "total_income": total_income,
        "average_monthly_income": avg_monthly_income,
        "final_portfolio_value": final_projection.total_investments,
        "final_month": final_projection.month
    }
