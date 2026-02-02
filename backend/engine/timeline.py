"""
Timeline generator for retirement projections.

Generates a sequence of months from start to end, with utilities for
date parsing and month arithmetic.
"""

from typing import Iterator, Tuple
from datetime import date
from dateutil.relativedelta import relativedelta


class Timeline:
    """
    Generates monthly timeline for projections.
    
    Example:
        timeline = Timeline("2026-01", 2028)
        for year_month, month_num in timeline.months():
            # Process each month
            pass
    """
    
    def __init__(self, start_month: str, end_year: int):
        """
        Initialize timeline.
        
        Args:
            start_month: Start in YYYY-MM format
            end_year: Last year to project through (inclusive, through December)
        """
        self.start_month = start_month
        self.end_year = end_year
        self.start_date = self._parse_month(start_month)
        self.end_date = date(end_year, 12, 31)
    
    @staticmethod
    def _parse_month(year_month: str) -> date:
        """
        Parse YYYY-MM string to date (first day of month).
        
        Args:
            year_month: String in YYYY-MM format
            
        Returns:
            Date object for first day of that month
        """
        year, month = year_month.split('-')
        return date(int(year), int(month), 1)
    
    @staticmethod
    def _format_month(d: date) -> str:
        """
        Format date as YYYY-MM.
        
        Args:
            d: Date object
            
        Returns:
            String in YYYY-MM format
        """
        return f"{d.year:04d}-{d.month:02d}"
    
    def months(self) -> Iterator[Tuple[str, int]]:
        """
        Generate all months in the projection timeline.
        
        Yields:
            Tuple of (year_month, month_number) where month_number is 1-based
            (1 = January, 12 = December)
            
        Example:
            for year_month, month_num in timeline.months():
                print(f"{year_month}: month {month_num}")
                # "2026-01: month 1"
                # "2026-02: month 2"
        """
        current = self.start_date
        
        while current <= self.end_date:
            yield self._format_month(current), current.month
            current = current + relativedelta(months=1)
    
    def total_months(self) -> int:
        """
        Calculate total number of months in projection.
        
        Returns:
            Total count of months
        """
        count = 0
        for _ in self.months():
            count += 1
        return count
    
    def get_year(self, year_month: str) -> int:
        """
        Extract year from YYYY-MM string.
        
        Args:
            year_month: String in YYYY-MM format
            
        Returns:
            Year as integer
        """
        return int(year_month.split('-')[0])
    
    def get_month_number(self, year_month: str) -> int:
        """
        Extract month number from YYYY-MM string.
        
        Args:
            year_month: String in YYYY-MM format
            
        Returns:
            Month number (1-12)
        """
        return int(year_month.split('-')[1])
    
    def is_year_end(self, year_month: str) -> bool:
        """
        Check if this is the last month of a year (December).
        
        Args:
            year_month: String in YYYY-MM format
            
        Returns:
            True if December, False otherwise
        """
        return self.get_month_number(year_month) == 12
    
    def is_year_start(self, year_month: str) -> bool:
        """
        Check if this is the first month of a year (January).
        
        Args:
            year_month: String in YYYY-MM format
            
        Returns:
            True if January, False otherwise
        """
        return self.get_month_number(year_month) == 1
    
    def next_month(self, year_month: str) -> str:
        """
        Get the next month.
        
        Args:
            year_month: String in YYYY-MM format
            
        Returns:
            Next month in YYYY-MM format
        """
        current = self._parse_month(year_month)
        next_date = current + relativedelta(months=1)
        return self._format_month(next_date)
    
    def previous_month(self, year_month: str) -> str:
        """
        Get the previous month.
        
        Args:
            year_month: String in YYYY-MM format
            
        Returns:
            Previous month in YYYY-MM format
        """
        current = self._parse_month(year_month)
        prev_date = current - relativedelta(months=1)
        return self._format_month(prev_date)
    
    def is_first_occurrence_of_month(
        self, 
        year_month: str, 
        target_month: int
    ) -> bool:
        """
        Check if this is the first time we've encountered this month number in the year.
        
        Useful for annual events that occur in a specific month (like COLA increases).
        
        Args:
            year_month: Current month in YYYY-MM format
            target_month: Target month number (1-12)
            
        Returns:
            True if this is the target month
        """
        return self.get_month_number(year_month) == target_month


def month_is_before(month1: str, month2: str) -> bool:
    """
    Check if month1 is before month2.
    
    Args:
        month1: First month in YYYY-MM format
        month2: Second month in YYYY-MM format
        
    Returns:
        True if month1 < month2
    """
    y1, m1 = map(int, month1.split('-'))
    y2, m2 = map(int, month2.split('-'))
    
    if y1 < y2:
        return True
    if y1 > y2:
        return False
    return m1 < m2


def month_is_after(month1: str, month2: str) -> bool:
    """
    Check if month1 is after month2.
    
    Args:
        month1: First month in YYYY-MM format
        month2: Second month in YYYY-MM format
        
    Returns:
        True if month1 > month2
    """
    y1, m1 = map(int, month1.split('-'))
    y2, m2 = map(int, month2.split('-'))
    
    if y1 > y2:
        return True
    if y1 < y2:
        return False
    return m1 > m2


def months_between(start_month: str, end_month: str) -> int:
    """
    Calculate number of months between two months (inclusive).
    
    Args:
        start_month: Start month in YYYY-MM format
        end_month: End month in YYYY-MM format
        
    Returns:
        Number of months between (inclusive)
    """
    start = Timeline._parse_month(start_month)
    end = Timeline._parse_month(end_month)
    
    delta = relativedelta(end, start)
    return delta.years * 12 + delta.months + 1
