"""
Income stream processor with COLA (Cost of Living Adjustment) logic.

COLA increases are applied annually in the month specified by the user.
The increase is multiplicative: new_amount = current_amount * (1 + cola_rate)
"""

from typing import Dict, Optional
from models import IncomeStream
from .timeline import month_is_before, month_is_after


class IncomeState:
    """
    Tracks the current state of an income stream.
    
    Manages the current monthly amount, which can change due to COLA increases.
    """
    
    def __init__(self, stream: IncomeStream):
        """
        Initialize income state.
        
        Args:
            stream: The income stream configuration
        """
        self.stream = stream
        self.current_amount = stream.monthly_amount_at_start
        self.last_cola_year: Optional[int] = None
    
    def apply_cola_if_due(self, year_month: str, month_num: int) -> None:
        """
        Apply COLA increase if this is the COLA month and we haven't applied it this year.
        
        COLA Logic:
        - COLA increases happen once per year
        - They occur in the month specified by stream.cola_month
        - Formula: current_amount *= (1 + cola_percent_annual)
        
        Args:
            year_month: Current month in YYYY-MM format
            month_num: Current month number (1-12)
        """
        # Check if this is the COLA month
        if month_num != self.stream.cola_month:
            return
        
        # Extract current year
        current_year = int(year_month.split('-')[0])
        
        # Check if we already applied COLA this year
        if self.last_cola_year == current_year:
            return
        
        # Apply COLA increase
        if self.stream.cola_percent_annual > 0:
            self.current_amount *= (1 + self.stream.cola_percent_annual)
            self.last_cola_year = current_year
    
    def get_amount(self) -> float:
        """
        Get the current monthly amount.
        
        Returns:
            Current monthly payment amount
        """
        return self.current_amount


class IncomeProcessor:
    """
    Processes all income streams for a projection.
    
    Manages the state of all income streams and calculates monthly income.
    """
    
    def __init__(self, income_streams: list[IncomeStream]):
        """
        Initialize processor with income streams.
        
        Args:
            income_streams: List of income stream configurations
        """
        self.streams = income_streams
        self.states: Dict[str, IncomeState] = {
            stream.stream_id: IncomeState(stream)
            for stream in income_streams
        }
    
    def process_month(
        self, 
        year_month: str, 
        month_num: int
    ) -> Dict[str, float]:
        """
        Process all income streams for a given month.
        
        This applies COLA increases (if due) and returns the income amounts.
        
        Args:
            year_month: Current month in YYYY-MM format
            month_num: Current month number (1-12)
            
        Returns:
            Dictionary mapping stream_id to monthly income amount
        """
        income_by_stream: Dict[str, float] = {}
        
        for stream in self.streams:
            # Check if stream has started
            if month_is_before(year_month, stream.start_month):
                # Stream hasn't started yet
                income_by_stream[stream.stream_id] = 0.0
                continue
            
            # Check if stream has ended
            if stream.end_month and month_is_after(year_month, stream.end_month):
                # Stream has ended
                income_by_stream[stream.stream_id] = 0.0
                continue
            
            # Get state for this stream
            state = self.states[stream.stream_id]
            
            # Apply COLA if due
            state.apply_cola_if_due(year_month, month_num)
            
            # Record income
            income_by_stream[stream.stream_id] = state.get_amount()
        
        return income_by_stream
    
    def get_total_income(self, income_by_stream: Dict[str, float]) -> float:
        """
        Calculate total income from all streams.
        
        Args:
            income_by_stream: Dictionary of income amounts by stream
            
        Returns:
            Total income across all streams
        """
        return sum(income_by_stream.values())
    
    def get_income_by_type(
        self, 
        income_by_stream: Dict[str, float]
    ) -> Dict[str, float]:
        """
        Group income by stream type (pension, social_security, other).
        
        Args:
            income_by_stream: Dictionary of income amounts by stream
            
        Returns:
            Dictionary mapping stream type to total income
        """
        by_type: Dict[str, float] = {}
        
        for stream in self.streams:
            stream_type = stream.type.value
            amount = income_by_stream.get(stream.stream_id, 0.0)
            
            if stream_type in by_type:
                by_type[stream_type] += amount
            else:
                by_type[stream_type] = amount
        
        return by_type
    
    def get_social_security_income(
        self, 
        income_by_stream: Dict[str, float]
    ) -> float:
        """
        Get total Social Security income for the month.
        
        This is needed for tax calculations.
        
        Args:
            income_by_stream: Dictionary of income amounts by stream
            
        Returns:
            Total Social Security income
        """
        total = 0.0
        for stream in self.streams:
            if stream.type.value == "social_security":
                total += income_by_stream.get(stream.stream_id, 0.0)
        return total
    
    def get_current_amounts(self) -> Dict[str, float]:
        """
        Get current amounts for all streams (after COLA adjustments).
        
        Returns:
            Dictionary mapping stream_id to current monthly amount
        """
        return {
            stream_id: state.get_amount()
            for stream_id, state in self.states.items()
        }
