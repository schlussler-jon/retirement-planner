"""
Unit tests for budget inflation and survivor spending.

Tests inflation application and survivor reduction logic.
"""

import pytest
from datetime import date
from models import (
    BudgetSettings,
    BudgetCategory,
    Person,
)
from budget.inflation import (
    BudgetState,
    BudgetProcessor,
    calculate_inflation_adjusted_amount,
    estimate_lifetime_spending,
)


class TestBudgetState:
    """Tests for BudgetState class."""
    
    def test_initial_state(self):
        """Test initial budget state."""
        settings = BudgetSettings(
            categories=[
                BudgetCategory(
                    category_name="Housing",
                    category_type="fixed",
                    monthly_amount=2000,
                    include=True
                ),
                BudgetCategory(
                    category_name="Food",
                    category_type="flexible",
                    monthly_amount=800,
                    include=True
                ),
            ],
            inflation_annual_percent=0.03,
            survivor_flexible_reduction_percent=0.25,
            survivor_reduction_mode="flex_only"
        )
        
        state = BudgetState(settings)
        
        assert state.current_amounts["Housing"] == 2000
        assert state.current_amounts["Food"] == 800
        assert state.get_total_monthly_spending() == 2800
    
    def test_excluded_category(self):
        """Test that excluded categories are not tracked."""
        settings = BudgetSettings(
            categories=[
                BudgetCategory(
                    category_name="Included",
                    category_type="fixed",
                    monthly_amount=1000,
                    include=True
                ),
                BudgetCategory(
                    category_name="Excluded",
                    category_type="fixed",
                    monthly_amount=500,
                    include=False
                ),
            ],
            inflation_annual_percent=0.0
        )
        
        state = BudgetState(settings)
        
        assert "Included" in state.current_amounts
        assert "Excluded" not in state.current_amounts
        assert state.get_total_monthly_spending() == 1000


class TestInflation:
    """Tests for inflation application."""
    
    def test_inflation_applied_in_january(self):
        """Test inflation is applied in January."""
        settings = BudgetSettings(
            categories=[
                BudgetCategory(
                    category_name="Spending",
                    category_type="fixed",
                    monthly_amount=1000,
                    include=True
                ),
            ],
            inflation_annual_percent=0.03  # 3%
        )
        
        state = BudgetState(settings)
        
        # December - no inflation yet
        state.apply_inflation_if_due("2026-12", 12)
        assert state.current_amounts["Spending"] == 1000
        
        # January - inflation applied
        state.apply_inflation_if_due("2027-01", 1)
        assert abs(state.current_amounts["Spending"] - 1030) < 0.01  # 1000 * 1.03
    
    def test_inflation_only_once_per_year(self):
        """Test inflation is only applied once per year."""
        settings = BudgetSettings(
            categories=[
                BudgetCategory(
                    category_name="Spending",
                    category_type="fixed",
                    monthly_amount=1000,
                    include=True
                ),
            ],
            inflation_annual_percent=0.03
        )
        
        state = BudgetState(settings)
        
        # Apply in January
        state.apply_inflation_if_due("2026-01", 1)
        amount_after_first = state.current_amounts["Spending"]
        
        # Try to apply again in same January
        state.apply_inflation_if_due("2026-01", 1)
        assert state.current_amounts["Spending"] == amount_after_first  # No change
    
    def test_multi_year_inflation(self):
        """Test inflation over multiple years."""
        settings = BudgetSettings(
            categories=[
                BudgetCategory(
                    category_name="Spending",
                    category_type="fixed",
                    monthly_amount=1000,
                    include=True
                ),
            ],
            inflation_annual_percent=0.04  # 4%
        )
        
        state = BudgetState(settings)
        
        # Year 1
        state.apply_inflation_if_due("2026-01", 1)
        assert abs(state.current_amounts["Spending"] - 1040) < 0.01
        
        # Year 2
        state.apply_inflation_if_due("2027-01", 1)
        assert abs(state.current_amounts["Spending"] - 1081.6) < 0.1  # 1040 * 1.04
        
        # Year 3
        state.apply_inflation_if_due("2028-01", 1)
        assert abs(state.current_amounts["Spending"] - 1124.86) < 0.1  # 1081.6 * 1.04
    
    def test_zero_inflation(self):
        """Test with zero inflation."""
        settings = BudgetSettings(
            categories=[
                BudgetCategory(
                    category_name="Spending",
                    category_type="fixed",
                    monthly_amount=1000,
                    include=True
                ),
            ],
            inflation_annual_percent=0.0
        )
        
        state = BudgetState(settings)
        
        state.apply_inflation_if_due("2026-01", 1)
        assert state.current_amounts["Spending"] == 1000
        
        state.apply_inflation_if_due("2027-01", 1)
        assert state.current_amounts["Spending"] == 1000  # No change


class TestSurvivorReduction:
    """Tests for survivor spending reduction."""
    
    def test_survivor_reduction_flexible_only(self):
        """Test survivor reduction for flexible categories only."""
        settings = BudgetSettings(
            categories=[
                BudgetCategory(
                    category_name="Housing",
                    category_type="fixed",
                    monthly_amount=2000,
                    include=True
                ),
                BudgetCategory(
                    category_name="Food",
                    category_type="flexible",
                    monthly_amount=800,
                    include=True
                ),
                BudgetCategory(
                    category_name="Entertainment",
                    category_type="flexible",
                    monthly_amount=400,
                    include=True
                ),
            ],
            inflation_annual_percent=0.0,
            survivor_flexible_reduction_percent=0.25,  # 25% reduction
            survivor_reduction_mode="flex_only"
        )
        
        people = [
            Person(
                person_id="p1",
                name="Person 1",
                birth_date=date(1960, 1, 1),
                life_expectancy_years=67  # Dies in 2027
            ),
            Person(
                person_id="p2",
                name="Person 2",
                birth_date=date(1965, 1, 1),
                life_expectancy_years=90
            )
        ]
        
        state = BudgetState(settings)
        
        # Before death
        state.apply_survivor_reduction_if_needed("2026-12", people)
        assert state.current_amounts["Housing"] == 2000  # No change (fixed)
        assert state.current_amounts["Food"] == 800  # No change yet
        
        # After death (2027-01)
        state.apply_survivor_reduction_if_needed("2027-01", people)
        assert state.current_amounts["Housing"] == 2000  # No change (fixed)
        assert abs(state.current_amounts["Food"] - 600) < 0.01  # 800 * 0.75
        assert abs(state.current_amounts["Entertainment"] - 300) < 0.01  # 400 * 0.75
    
    def test_survivor_reduction_all_categories(self):
        """Test survivor reduction for all categories."""
        settings = BudgetSettings(
            categories=[
                BudgetCategory(
                    category_name="Housing",
                    category_type="fixed",
                    monthly_amount=2000,
                    include=True
                ),
                BudgetCategory(
                    category_name="Food",
                    category_type="flexible",
                    monthly_amount=800,
                    include=True
                ),
            ],
            inflation_annual_percent=0.0,
            survivor_flexible_reduction_percent=0.30,  # 30% reduction
            survivor_reduction_mode="all"
        )
        
        people = [
            Person(
                person_id="p1",
                name="Person 1",
                birth_date=date(1960, 1, 1),
                life_expectancy_years=67
            ),
            Person(
                person_id="p2",
                name="Person 2",
                birth_date=date(1965, 1, 1),
                life_expectancy_years=90
            )
        ]
        
        state = BudgetState(settings)
        
        # After death
        state.apply_survivor_reduction_if_needed("2027-01", people)
        
        # Both reduced by 30%
        assert abs(state.current_amounts["Housing"] - 1400) < 0.01  # 2000 * 0.70
        assert abs(state.current_amounts["Food"] - 560) < 0.01  # 800 * 0.70
    
    def test_survivor_reduction_only_once(self):
        """Test survivor reduction is only applied once."""
        settings = BudgetSettings(
            categories=[
                BudgetCategory(
                    category_name="Spending",
                    category_type="flexible",
                    monthly_amount=1000,
                    include=True
                ),
            ],
            inflation_annual_percent=0.0,
            survivor_flexible_reduction_percent=0.25,
            survivor_reduction_mode="flex_only"
        )
        
        people = [
            Person(
                person_id="p1",
                name="Person 1",
                birth_date=date(1960, 1, 1),
                life_expectancy_years=67
            ),
            Person(
                person_id="p2",
                name="Person 2",
                birth_date=date(1965, 1, 1),
                life_expectancy_years=90
            )
        ]
        
        state = BudgetState(settings)
        
        # First application
        state.apply_survivor_reduction_if_needed("2027-01", people)
        amount_after_reduction = state.current_amounts["Spending"]
        assert abs(amount_after_reduction - 750) < 0.01  # 1000 * 0.75
        
        # Try to apply again
        state.apply_survivor_reduction_if_needed("2027-06", people)
        assert state.current_amounts["Spending"] == amount_after_reduction  # No change


class TestBudgetProcessor:
    """Tests for BudgetProcessor class."""
    
    def test_process_multiple_months(self):
        """Test processing budget over multiple months."""
        settings = BudgetSettings(
            categories=[
                BudgetCategory(
                    category_name="Spending",
                    category_type="fixed",
                    monthly_amount=5000,
                    include=True
                ),
            ],
            inflation_annual_percent=0.03
        )
        
        people = []
        
        processor = BudgetProcessor(settings, people)
        
        # December 2026
        spending_dec = processor.process_month("2026-12", 12)
        assert spending_dec == 5000
        
        # January 2027 - inflation applied
        spending_jan = processor.process_month("2027-01", 1)
        assert abs(spending_jan - 5150) < 1  # 5000 * 1.03
        
        # February 2027 - same as January
        spending_feb = processor.process_month("2027-02", 2)
        assert abs(spending_feb - 5150) < 1


class TestUtilityFunctions:
    """Tests for utility functions."""
    
    def test_calculate_inflation_adjusted_amount(self):
        """Test inflation adjustment calculation."""
        # 3% inflation for 5 years
        result = calculate_inflation_adjusted_amount(
            starting_amount=1000,
            years=5,
            annual_inflation_rate=0.03
        )
        
        # 1000 * (1.03^5) = 1159.27
        assert abs(result - 1159.27) < 0.1
    
    def test_estimate_lifetime_spending(self):
        """Test lifetime spending estimation."""
        # $5000/month for 3 years with 4% inflation
        total = estimate_lifetime_spending(
            monthly_spending=5000,
            years_remaining=3,
            annual_inflation_rate=0.04
        )
        
        # Year 1: 60,000
        # Year 2: 62,400 (60k * 1.04)
        # Year 3: 64,896 (62.4k * 1.04)
        # Total: ~187,296
        assert abs(total - 187296) < 100


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
