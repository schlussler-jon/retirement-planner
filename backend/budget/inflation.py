"""
Budget inflation and survivor spending calculations.

Handles:
- Annual inflation applied to all spending categories
- Survivor spending reduction when one person passes away
- Monthly spending projections
"""

from typing import Dict, List, Optional
from models import BudgetSettings, BudgetCategory, Person


class BudgetState:
    """
    Tracks the current state of the budget.
    
    Budget amounts change over time due to:
    1. Annual inflation (applied to all categories)
    2. Survivor spending reduction (when someone passes away)
    """
    
    def __init__(self, budget_settings: BudgetSettings):
        """
        Initialize budget state.
        
        Args:
            budget_settings: Budget configuration with categories and settings
        """
        self.settings = budget_settings
        
        # Track current amounts for each category
        self.current_amounts: Dict[str, float] = {}
        for category in budget_settings.categories:
            if category.include:
                self.current_amounts[category.category_name] = category.monthly_amount
        
        # Track inflation state
        self.last_inflation_year: Optional[int] = None
        
        # Track survivor reduction state
        self.survivor_reduction_applied = False
    
    def apply_inflation_if_due(self, year_month: str, month_num: int) -> None:
        """
        Apply annual inflation to all budget categories.
        
        Inflation is applied once per year in January.
        
        Args:
            year_month: Current month in YYYY-MM format
            month_num: Current month number (1-12)
        """
        # Only apply in January
        if month_num != 1:
            return
        
        # Extract current year
        current_year = int(year_month.split('-')[0])
        
        # Check if we already applied inflation this year
        if self.last_inflation_year == current_year:
            return
        
        # Apply inflation to all categories
        inflation_rate = self.settings.inflation_annual_percent
        
        if inflation_rate > 0:
            for category_name in self.current_amounts:
                self.current_amounts[category_name] *= (1 + inflation_rate)
            
            self.last_inflation_year = current_year
    
    def apply_survivor_reduction_if_needed(
        self,
        year_month: str,
        people: List[Person]
    ) -> None:
        """
        Apply survivor spending reduction if someone has passed away.
        
        When one person in a couple passes away, spending may decrease.
        The reduction can apply to:
        - Only flexible categories (survivor_reduction_mode = "flex_only")
        - All categories (survivor_reduction_mode = "all")
        
        Args:
            year_month: Current month in YYYY-MM format
            people: List of Person objects to check for death dates
        """
        # Only apply reduction once
        if self.survivor_reduction_applied:
            return
        
        # Only relevant if there are 2+ people
        if len(people) < 2:
            return
        
        # Check if anyone has passed away
        current_year_month = year_month
        someone_deceased = False
        
        for person in people:
            if person.death_year_month:
                # Compare year-month strings
                if current_year_month >= person.death_year_month:
                    someone_deceased = True
                    break
        
        if not someone_deceased:
            return
        
        # Apply reduction
        reduction_percent = self.settings.survivor_flexible_reduction_percent
        reduction_mode = self.settings.survivor_reduction_mode
        
        if reduction_percent <= 0:
            self.survivor_reduction_applied = True
            return
        
        # Reduce amounts based on mode
        for category in self.settings.categories:
            if not category.include:
                continue
            
            category_name = category.category_name
            
            if reduction_mode == "all":
                # Reduce all categories
                self.current_amounts[category_name] *= (1 - reduction_percent)
            
            elif reduction_mode == "flex_only":
                # Only reduce flexible categories
                if category.category_type == "flexible":
                    self.current_amounts[category_name] *= (1 - reduction_percent)
        
        self.survivor_reduction_applied = True
    
    def get_total_monthly_spending(self) -> float:
        """
        Get total monthly spending across all included categories.
        
        Returns:
            Total monthly spending amount
        """
        return sum(self.current_amounts.values())
    
    def get_spending_by_category(self) -> Dict[str, float]:
        """
        Get current spending amounts by category.
        
        Returns:
            Dictionary mapping category name to current amount
        """
        return self.current_amounts.copy()


class BudgetProcessor:
    """
    Processes budget projections with inflation and survivor logic.
    """
    
    def __init__(
        self,
        budget_settings: BudgetSettings,
        people: List[Person]
    ):
        """
        Initialize budget processor.
        
        Args:
            budget_settings: Budget configuration
            people: List of people in the scenario
        """
        self.settings = budget_settings
        self.people = people
        self.state = BudgetState(budget_settings)
    
    def process_month(self, year_month: str, month_num: int) -> float:
        """
        Process budget for a single month.
        
        This applies inflation (if due) and survivor reduction (if needed),
        then returns the total monthly spending.
        
        Args:
            year_month: Current month in YYYY-MM format
            month_num: Current month number (1-12)
            
        Returns:
            Total monthly spending for this month
        """
        # Apply inflation (January only)
        self.state.apply_inflation_if_due(year_month, month_num)
        
        # Apply survivor reduction (if needed)
        self.state.apply_survivor_reduction_if_needed(year_month, self.people)
        
        # Return total spending
        return self.state.get_total_monthly_spending()
    
    def get_current_spending(self) -> float:
        """
        Get current total monthly spending.
        
        Returns:
            Current monthly spending amount
        """
        return self.state.get_total_monthly_spending()
    
    def get_spending_breakdown(self) -> Dict[str, float]:
        """
        Get current spending by category.
        
        Returns:
            Dictionary of spending amounts by category
        """
        return self.state.get_spending_by_category()
    
    def get_annual_spending(self) -> float:
        """
        Get estimated annual spending (current monthly × 12).
        
        Returns:
            Estimated annual spending
        """
        return self.state.get_total_monthly_spending() * 12


def calculate_inflation_adjusted_amount(
    starting_amount: float,
    years: int,
    annual_inflation_rate: float
) -> float:
    """
    Calculate inflation-adjusted amount.
    
    Formula: amount × (1 + rate)^years
    
    Args:
        starting_amount: Initial amount
        years: Number of years of inflation
        annual_inflation_rate: Annual inflation rate as decimal
        
    Returns:
        Inflation-adjusted amount
    """
    return starting_amount * ((1 + annual_inflation_rate) ** years)


def estimate_lifetime_spending(
    monthly_spending: float,
    years_remaining: int,
    annual_inflation_rate: float
) -> float:
    """
    Estimate total lifetime spending with inflation.
    
    This is a rough estimate - actual spending will vary with
    inflation and survivor reduction.
    
    Args:
        monthly_spending: Current monthly spending
        years_remaining: Years of spending remaining
        annual_inflation_rate: Annual inflation rate
        
    Returns:
        Estimated lifetime spending
    """
    total = 0.0
    
    for year in range(years_remaining):
        # Amount for this year (inflation-adjusted)
        year_amount = calculate_inflation_adjusted_amount(
            monthly_spending * 12,
            year,
            annual_inflation_rate
        )
        total += year_amount
    
    return total
