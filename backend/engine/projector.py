"""
Main projection engine.

Combines timeline, income, and account processors to generate
month-by-month financial projections.
"""

from typing import List, Optional
from models import (
    Scenario,
    MonthlyProjection,
    FilingStatus,
)
from .timeline import Timeline
from .income import IncomeProcessor
from .accounts import AccountProcessor


class ProjectionEngine:
    """
    Main projection engine that orchestrates all calculations.
    
    This is the core of the retirement planning system. It:
    1. Iterates through each month in the timeline
    2. Processes income (with COLA adjustments)
    3. Processes accounts (contributions, withdrawals, growth)
    4. Records monthly snapshots
    
    The engine is deterministic and stateless - it can be run
    multiple times on the same scenario with identical results.
    """
    
    def __init__(self, scenario: Scenario):
        """
        Initialize projection engine with a scenario.
        
        Args:
            scenario: Complete retirement planning scenario
        """
        self.scenario = scenario
        
        # Initialize timeline
        self.timeline = Timeline(
            scenario.global_settings.projection_start_month,
            scenario.global_settings.projection_end_year
        )
        
        # Initialize processors
        self.income_processor = IncomeProcessor(scenario.income_streams)
        self.account_processor = AccountProcessor(scenario.accounts)
        
        # Track filing status changes (due to death dates)
        self.filing_status_tracker = FilingStatusTracker(
            scenario.people,
            scenario.tax_settings.filing_status
        )
    
    def run(self) -> List[MonthlyProjection]:
        """
        Run the complete projection.
        
        This is the main entry point. It iterates through all months
        and generates a MonthlyProjection for each one.
        
        Returns:
            List of MonthlyProjection objects, one per month
        """
        monthly_projections: List[MonthlyProjection] = []
        
        # Iterate through all months
        for year_month, month_num in self.timeline.months():
            # Update filing status (may change if someone passes away)
            current_filing_status = self.filing_status_tracker.get_status(year_month)
            
            # Process income (with COLA)
            income_by_stream = self.income_processor.process_month(
                year_month, 
                month_num
            )
            total_income = self.income_processor.get_total_income(income_by_stream)
            
            # Process accounts (contributions, withdrawals, growth)
            withdrawals_by_account, balances_by_account = (
                self.account_processor.process_month(year_month)
            )
            
            # Calculate totals
            total_withdrawals = sum(withdrawals_by_account.values())
            total_investments = self.account_processor.get_total_balance()
            total_gross_cashflow = total_income + total_withdrawals
            
            # Group by tax bucket
            balances_by_tax_bucket = (
                self.account_processor.get_balances_by_tax_bucket()
            )
            withdrawals_by_tax_bucket = (
                self.account_processor.get_withdrawals_by_tax_bucket(
                    withdrawals_by_account
                )
            )
            
            # Create monthly projection
            projection = MonthlyProjection(
                month=year_month,
                income_by_stream=income_by_stream,
                withdrawals_by_account=withdrawals_by_account,
                withdrawals_by_tax_bucket=withdrawals_by_tax_bucket,
                balances_by_account=balances_by_account,
                balances_by_tax_bucket=balances_by_tax_bucket,
                total_investments=total_investments,
                total_gross_cashflow=total_gross_cashflow,
                filing_status=current_filing_status.value
            )
            
            monthly_projections.append(projection)
        
        return monthly_projections
    
    def get_timeline(self) -> Timeline:
        """
        Get the timeline being used.
        
        Returns:
            Timeline object
        """
        return self.timeline


class FilingStatusTracker:
    """
    Tracks changes in filing status due to death dates.
    
    When one person in a married couple passes away, the filing status
    changes from married_filing_jointly to single (in the year after death).
    """
    
    def __init__(self, people: list, initial_status: FilingStatus):
        """
        Initialize tracker.
        
        Args:
            people: List of Person objects
            initial_status: Starting filing status
        """
        self.people = people
        self.initial_status = initial_status
        
        # Extract death dates
        self.death_dates = []
        for person in people:
            if person.death_year_month:
                self.death_dates.append(person.death_year_month)
    
    def get_status(self, year_month: str) -> FilingStatus:
        """
        Get filing status for a given month.
        
        Logic:
        - If married and both alive: married_filing_jointly
        - If married and one deceased: single (starting year after death)
        - If single: always single
        
        Args:
            year_month: Month in YYYY-MM format
            
        Returns:
            Filing status for that month
        """
        # If not married initially, always single
        if self.initial_status != FilingStatus.MARRIED_FILING_JOINTLY:
            return self.initial_status
        
        # Check if we're in a married couple scenario
        if len(self.people) < 2:
            return self.initial_status
        
        # Check if anyone has passed away
        current_year = int(year_month.split('-')[0])
        
        for death_date in self.death_dates:
            death_year = int(death_date.split('-')[0])
            
            # In the year after death, switch to single
            if current_year > death_year:
                return FilingStatus.SINGLE
        
        return FilingStatus.MARRIED_FILING_JOINTLY
