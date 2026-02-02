"""
Unit tests for budget and tax models.

Tests BudgetCategory, BudgetSettings, TaxSettings, and StateTaxConfig.
"""

import pytest
from pydantic import ValidationError
from models.budget import (
    BudgetCategory,
    BudgetSettings,
    TaxSettings,
    FilingStatus,
    CategoryType,
    SurvivorReductionMode,
    StateTaxConfig,
)


class TestBudgetCategory:
    """Tests for BudgetCategory model."""
    
    def test_valid_fixed_category(self):
        """Test creating a valid fixed category."""
        category = BudgetCategory(
            category_name="Housing",
            category_type=CategoryType.FIXED,
            monthly_amount=1500.0,
            include=True
        )
        assert category.category_name == "Housing"
        assert category.category_type == CategoryType.FIXED
        assert category.include is True
    
    def test_valid_flexible_category(self):
        """Test creating a valid flexible category."""
        category = BudgetCategory(
            category_name="Travel",
            category_type=CategoryType.FLEXIBLE,
            monthly_amount=400.0
        )
        assert category.category_type == CategoryType.FLEXIBLE
        assert category.include is True  # Default
    
    def test_excluded_category(self):
        """Test category marked as excluded."""
        category = BudgetCategory(
            category_name="Optional",
            category_type=CategoryType.FLEXIBLE,
            monthly_amount=200.0,
            include=False
        )
        assert category.include is False
    
    def test_negative_amount_invalid(self):
        """Test that negative amounts are rejected."""
        with pytest.raises(ValidationError):
            BudgetCategory(
                category_name="Test",
                category_type=CategoryType.FIXED,
                monthly_amount=-100.0
            )
    
    def test_empty_name_invalid(self):
        """Test that empty names are rejected."""
        with pytest.raises(ValidationError):
            BudgetCategory(
                category_name="",
                category_type=CategoryType.FIXED,
                monthly_amount=100.0
            )


class TestBudgetSettings:
    """Tests for BudgetSettings model."""
    
    def test_valid_budget_settings(self):
        """Test creating valid budget settings."""
        categories = [
            BudgetCategory(
                category_name="Housing",
                category_type=CategoryType.FIXED,
                monthly_amount=1500.0
            ),
            BudgetCategory(
                category_name="Groceries",
                category_type=CategoryType.FIXED,
                monthly_amount=800.0
            ),
            BudgetCategory(
                category_name="Travel",
                category_type=CategoryType.FLEXIBLE,
                monthly_amount=400.0
            ),
        ]
        
        budget = BudgetSettings(
            categories=categories,
            inflation_annual_percent=0.025,
            survivor_flexible_reduction_percent=0.25,
            survivor_reduction_mode=SurvivorReductionMode.FLEX_ONLY
        )
        
        assert len(budget.categories) == 3
        assert budget.inflation_annual_percent == 0.025
        assert budget.survivor_reduction_mode == SurvivorReductionMode.FLEX_ONLY
    
    def test_total_monthly_spending(self):
        """Test total spending calculation."""
        categories = [
            BudgetCategory(
                category_name="Housing",
                category_type=CategoryType.FIXED,
                monthly_amount=1500.0,
                include=True
            ),
            BudgetCategory(
                category_name="Groceries",
                category_type=CategoryType.FIXED,
                monthly_amount=800.0,
                include=True
            ),
            BudgetCategory(
                category_name="Optional",
                category_type=CategoryType.FLEXIBLE,
                monthly_amount=300.0,
                include=False  # Excluded
            ),
        ]
        
        budget = BudgetSettings(categories=categories)
        assert budget.total_monthly_spending() == 2300.0  # 1500 + 800, excluding 300
    
    def test_total_fixed_spending(self):
        """Test fixed spending calculation."""
        categories = [
            BudgetCategory(
                category_name="Housing",
                category_type=CategoryType.FIXED,
                monthly_amount=1500.0
            ),
            BudgetCategory(
                category_name="Groceries",
                category_type=CategoryType.FIXED,
                monthly_amount=800.0
            ),
            BudgetCategory(
                category_name="Travel",
                category_type=CategoryType.FLEXIBLE,
                monthly_amount=400.0
            ),
        ]
        
        budget = BudgetSettings(categories=categories)
        assert budget.total_fixed_spending() == 2300.0  # 1500 + 800
    
    def test_total_flexible_spending(self):
        """Test flexible spending calculation."""
        categories = [
            BudgetCategory(
                category_name="Housing",
                category_type=CategoryType.FIXED,
                monthly_amount=1500.0
            ),
            BudgetCategory(
                category_name="Travel",
                category_type=CategoryType.FLEXIBLE,
                monthly_amount=400.0
            ),
            BudgetCategory(
                category_name="Entertainment",
                category_type=CategoryType.FLEXIBLE,
                monthly_amount=200.0
            ),
        ]
        
        budget = BudgetSettings(categories=categories)
        assert budget.total_flexible_spending() == 600.0  # 400 + 200
    
    def test_duplicate_category_names_invalid(self):
        """Test that duplicate category names are rejected."""
        categories = [
            BudgetCategory(
                category_name="Housing",
                category_type=CategoryType.FIXED,
                monthly_amount=1500.0
            ),
            BudgetCategory(
                category_name="Housing",  # Duplicate
                category_type=CategoryType.FIXED,
                monthly_amount=2000.0
            ),
        ]
        
        with pytest.raises(ValidationError) as exc_info:
            BudgetSettings(categories=categories)
        assert "unique" in str(exc_info.value).lower()
    
    def test_invalid_inflation_rate(self):
        """Test invalid inflation rates."""
        with pytest.raises(ValidationError):
            BudgetSettings(inflation_annual_percent=-0.1)
        
        with pytest.raises(ValidationError):
            BudgetSettings(inflation_annual_percent=0.25)  # Too high
    
    def test_invalid_survivor_reduction(self):
        """Test invalid survivor reduction percentages."""
        with pytest.raises(ValidationError):
            BudgetSettings(survivor_flexible_reduction_percent=-0.1)
        
        with pytest.raises(ValidationError):
            BudgetSettings(survivor_flexible_reduction_percent=1.5)
    
    def test_default_values(self):
        """Test default budget settings values."""
        budget = BudgetSettings()
        assert budget.inflation_annual_percent == 0.025
        assert budget.survivor_flexible_reduction_percent == 0.0
        assert budget.survivor_reduction_mode == SurvivorReductionMode.FLEX_ONLY
        assert len(budget.categories) == 0


class TestTaxSettings:
    """Tests for TaxSettings model."""
    
    def test_valid_mfj_settings(self):
        """Test valid married filing jointly settings."""
        tax = TaxSettings(
            filing_status=FilingStatus.MARRIED_FILING_JOINTLY,
            tax_year_ruleset=2024
        )
        assert tax.filing_status == FilingStatus.MARRIED_FILING_JOINTLY
        assert tax.standard_deduction_override is None
    
    def test_valid_single_settings(self):
        """Test valid single filing settings."""
        tax = TaxSettings(
            filing_status=FilingStatus.SINGLE,
            tax_year_ruleset=2024
        )
        assert tax.filing_status == FilingStatus.SINGLE
    
    def test_standard_deduction_override(self):
        """Test standard deduction override."""
        tax = TaxSettings(
            filing_status=FilingStatus.SINGLE,
            standard_deduction_override=15000.0,
            tax_year_ruleset=2024
        )
        assert tax.standard_deduction_override == 15000.0
    
    def test_negative_deduction_invalid(self):
        """Test that negative deduction is rejected."""
        with pytest.raises(ValidationError):
            TaxSettings(
                filing_status=FilingStatus.SINGLE,
                standard_deduction_override=-1000.0
            )
    
    def test_invalid_tax_year(self):
        """Test invalid tax year values."""
        with pytest.raises(ValidationError):
            TaxSettings(
                filing_status=FilingStatus.SINGLE,
                tax_year_ruleset=2019  # Too early
            )
        
        with pytest.raises(ValidationError):
            TaxSettings(
                filing_status=FilingStatus.SINGLE,
                tax_year_ruleset=2031  # Too late
            )
    
    def test_default_tax_year(self):
        """Test default tax year ruleset."""
        tax = TaxSettings(filing_status=FilingStatus.SINGLE)
        assert tax.tax_year_ruleset == 2024


class TestStateTaxConfig:
    """Tests for StateTaxConfig utility class."""
    
    def test_no_tax_states(self):
        """Test states with no income tax."""
        assert StateTaxConfig.get_state_rate("FL") == 0.0
        assert StateTaxConfig.get_state_rate("TX") == 0.0
        assert StateTaxConfig.get_state_rate("WA") == 0.0
        assert StateTaxConfig.get_state_rate("NV") == 0.0
    
    def test_known_state_rates(self):
        """Test states with known flat rates."""
        assert StateTaxConfig.get_state_rate("AZ") == 0.025
        assert StateTaxConfig.get_state_rate("CA") == 0.093
        assert StateTaxConfig.get_state_rate("CO") == 0.044
        assert StateTaxConfig.get_state_rate("IL") == 0.0495
    
    def test_unknown_state_fallback(self):
        """Test fallback for unknown states."""
        assert StateTaxConfig.get_state_rate("XX") == 0.05  # 5% fallback
        assert StateTaxConfig.get_state_rate("ZZ") == 0.05
    
    def test_lowercase_state_codes(self):
        """Test that lowercase codes work."""
        assert StateTaxConfig.get_state_rate("az") == 0.025
        assert StateTaxConfig.get_state_rate("fl") == 0.0
    
    def test_is_no_tax_state(self):
        """Test no-tax state checker."""
        assert StateTaxConfig.is_no_tax_state("FL") is True
        assert StateTaxConfig.is_no_tax_state("TX") is True
        assert StateTaxConfig.is_no_tax_state("CA") is False
        assert StateTaxConfig.is_no_tax_state("AZ") is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
