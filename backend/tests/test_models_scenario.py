"""
Unit tests for Scenario and output models.

Tests the main Scenario model and all output models.
"""

import pytest
from datetime import date
from pydantic import ValidationError
from models.scenario import Scenario
from models.core import Person, IncomeStream, InvestmentAccount, GlobalSettings, TaxBucket, IncomeStreamType
from models.budget import BudgetSettings, TaxSettings, FilingStatus, BudgetCategory, CategoryType
from models.outputs import (
    MonthlyProjection,
    AnnualSummary,
    TaxSummary,
    NetIncomeProjection,
    ProjectionResults,
)


class TestScenario:
    """Tests for Scenario model."""
    
    def test_minimal_valid_scenario(self):
        """Test creating a minimal valid scenario."""
        scenario = Scenario(
            scenario_id="test_001",
            scenario_name="Test Scenario",
            global_settings=GlobalSettings(
                projection_start_month="2026-01",
                projection_end_year=2056,
                residence_state="AZ"
            ),
            tax_settings=TaxSettings(
                filing_status=FilingStatus.SINGLE
            )
        )
        assert scenario.scenario_id == "test_001"
        assert scenario.scenario_name == "Test Scenario"
        assert len(scenario.people) == 0
        assert len(scenario.income_streams) == 0
        assert len(scenario.accounts) == 0
    
    def test_complete_scenario(self):
        """Test creating a complete scenario with all components."""
        person = Person(
            person_id="p1",
            name="Jon",
            birth_date=date(1963, 6, 9),
            life_expectancy_years=83
        )
        
        income = IncomeStream(
            stream_id="pension_1",
            type=IncomeStreamType.PENSION,
            owner_person_id="p1",
            start_month="2026-01",
            monthly_amount_at_start=8625.0,
            cola_percent_annual=0.02,
            cola_month=5
        )
        
        account = InvestmentAccount(
            account_id="401k_1",
            name="Jon 401k",
            tax_bucket=TaxBucket.TAX_DEFERRED,
            starting_balance=65000.0,
            annual_return_rate=0.06
        )
        
        budget = BudgetSettings(
            categories=[
                BudgetCategory(
                    category_name="Housing",
                    category_type=CategoryType.FIXED,
                    monthly_amount=1500.0
                )
            ],
            inflation_annual_percent=0.025
        )
        
        scenario = Scenario(
            scenario_id="test_002",
            scenario_name="Complete Test",
            description="Full scenario for testing",
            global_settings=GlobalSettings(
                projection_start_month="2026-01",
                projection_end_year=2056,
                residence_state="AZ"
            ),
            people=[person],
            income_streams=[income],
            accounts=[account],
            budget=budget,
            tax_settings=TaxSettings(
                filing_status=FilingStatus.MARRIED_FILING_JOINTLY
            )
        )
        
        assert len(scenario.people) == 1
        assert len(scenario.income_streams) == 1
        assert len(scenario.accounts) == 1
        assert len(scenario.budget.categories) == 1
    
    def test_duplicate_person_ids_invalid(self):
        """Test that duplicate person IDs are rejected."""
        people = [
            Person(person_id="p1", name="Jon", birth_date=date(1963, 6, 9)),
            Person(person_id="p1", name="Rebecca", birth_date=date(1966, 8, 1)),
        ]
        
        with pytest.raises(ValidationError) as exc_info:
            Scenario(
                scenario_id="test",
                scenario_name="Test",
                global_settings=GlobalSettings(
                    projection_start_month="2026-01",
                    projection_end_year=2056,
                    residence_state="AZ"
                ),
                people=people,
                tax_settings=TaxSettings(filing_status=FilingStatus.SINGLE)
            )
        assert "unique" in str(exc_info.value).lower()
    
    def test_duplicate_stream_ids_invalid(self):
        """Test that duplicate stream IDs are rejected."""
        streams = [
            IncomeStream(
                stream_id="s1",
                type=IncomeStreamType.PENSION,
                owner_person_id="p1",
                start_month="2026-01",
                monthly_amount_at_start=1000.0
            ),
            IncomeStream(
                stream_id="s1",  # Duplicate
                type=IncomeStreamType.PENSION,
                owner_person_id="p1",
                start_month="2026-01",
                monthly_amount_at_start=2000.0
            ),
        ]
        
        with pytest.raises(ValidationError) as exc_info:
            Scenario(
                scenario_id="test",
                scenario_name="Test",
                global_settings=GlobalSettings(
                    projection_start_month="2026-01",
                    projection_end_year=2056,
                    residence_state="AZ"
                ),
                income_streams=streams,
                tax_settings=TaxSettings(filing_status=FilingStatus.SINGLE)
            )
        assert "unique" in str(exc_info.value).lower()
    
    def test_duplicate_account_ids_invalid(self):
        """Test that duplicate account IDs are rejected."""
        accounts = [
            InvestmentAccount(
                account_id="a1",
                name="Account 1",
                tax_bucket=TaxBucket.ROTH,
                starting_balance=10000.0,
                annual_return_rate=0.06
            ),
            InvestmentAccount(
                account_id="a1",  # Duplicate
                name="Account 2",
                tax_bucket=TaxBucket.TAXABLE,
                starting_balance=20000.0,
                annual_return_rate=0.08
            ),
        ]
        
        with pytest.raises(ValidationError) as exc_info:
            Scenario(
                scenario_id="test",
                scenario_name="Test",
                global_settings=GlobalSettings(
                    projection_start_month="2026-01",
                    projection_end_year=2056,
                    residence_state="AZ"
                ),
                accounts=accounts,
                tax_settings=TaxSettings(filing_status=FilingStatus.SINGLE)
            )
        assert "unique" in str(exc_info.value).lower()
    
    def test_validate_references_success(self):
        """Test successful reference validation."""
        person = Person(person_id="p1", name="Jon", birth_date=date(1963, 6, 9))
        income = IncomeStream(
            stream_id="s1",
            type=IncomeStreamType.PENSION,
            owner_person_id="p1",  # Valid reference
            start_month="2026-01",
            monthly_amount_at_start=1000.0
        )
        
        scenario = Scenario(
            scenario_id="test",
            scenario_name="Test",
            global_settings=GlobalSettings(
                projection_start_month="2026-01",
                projection_end_year=2056,
                residence_state="AZ"
            ),
            people=[person],
            income_streams=[income],
            tax_settings=TaxSettings(filing_status=FilingStatus.SINGLE)
        )
        
        # Should not raise
        scenario.validate_references()
    
    def test_validate_references_invalid_person(self):
        """Test reference validation fails for invalid person ID."""
        income = IncomeStream(
            stream_id="s1",
            type=IncomeStreamType.PENSION,
            owner_person_id="nonexistent",  # Invalid reference
            start_month="2026-01",
            monthly_amount_at_start=1000.0
        )
        
        scenario = Scenario(
            scenario_id="test",
            scenario_name="Test",
            global_settings=GlobalSettings(
                projection_start_month="2026-01",
                projection_end_year=2056,
                residence_state="AZ"
            ),
            income_streams=[income],
            tax_settings=TaxSettings(filing_status=FilingStatus.SINGLE)
        )
        
        with pytest.raises(ValueError) as exc_info:
            scenario.validate_references()
        assert "non-existent person" in str(exc_info.value)


class TestOutputModels:
    """Tests for output models."""
    
    def test_monthly_projection(self):
        """Test MonthlyProjection model."""
        projection = MonthlyProjection(
            month="2026-01",
            income_by_stream={"pension_1": 8625.0, "ssa_1": 2597.0},
            withdrawals_by_account={"457b_1": 1900.0},
            withdrawals_by_tax_bucket={"tax_deferred": 1900.0},
            balances_by_account={"401k_1": 65000.0, "457b_1": 328100.0},
            balances_by_tax_bucket={"tax_deferred": 393100.0},
            total_investments=393100.0,
            total_gross_cashflow=13122.0,
            filing_status="married_filing_jointly"
        )
        assert projection.month == "2026-01"
        assert projection.total_investments == 393100.0
        assert projection.income_by_stream["pension_1"] == 8625.0
    
    def test_annual_summary(self):
        """Test AnnualSummary model."""
        summary = AnnualSummary(
            year=2026,
            total_income_year=157464.0,
            end_of_year_total_investments=450000.0
        )
        assert summary.year == 2026
        assert summary.total_income_year == 157464.0
    
    def test_tax_summary(self):
        """Test TaxSummary model."""
        tax = TaxSummary(
            year=2026,
            total_ssa_income=31164.0,
            taxable_ssa_income=26489.4,
            other_ordinary_income=126300.0,
            agi=152789.4,
            standard_deduction=29200.0,
            taxable_income=123589.4,
            federal_tax=18543.0,
            state_tax=3819.74,
            total_tax=22362.74,
            effective_tax_rate=0.146
        )
        assert tax.year == 2026
        assert tax.total_tax == 22362.74
        assert abs(tax.effective_tax_rate - 0.146) < 0.001
    
    def test_net_income_projection(self):
        """Test NetIncomeProjection model."""
        net = NetIncomeProjection(
            month="2026-01",
            gross_cashflow=13122.0,
            federal_tax_monthly_estimate=1545.25,
            state_tax_monthly_estimate=318.31,
            net_income_after_tax=11258.44,
            inflation_adjusted_spending=5825.0,
            surplus_deficit=5433.44
        )
        assert net.month == "2026-01"
        assert net.surplus_deficit == 5433.44
        assert net.net_income_after_tax > net.inflation_adjusted_spending
    
    def test_projection_results(self):
        """Test ProjectionResults container model."""
        monthly = MonthlyProjection(
            month="2026-12",
            total_investments=450000.0,
            total_gross_cashflow=13000.0
        )
        
        annual = AnnualSummary(
            year=2026,
            total_income_year=156000.0,
            end_of_year_total_investments=450000.0
        )
        
        net = NetIncomeProjection(
            month="2026-01",
            gross_cashflow=13000.0,
            surplus_deficit=5000.0
        )
        
        results = ProjectionResults(
            monthly_projections=[monthly],
            annual_summaries=[annual],
            tax_summaries=[],
            net_income_projections=[net]
        )
        
        assert len(results.monthly_projections) == 1
        assert results.get_final_portfolio_value() == 450000.0
        assert results.get_total_surplus_deficit() == 5000.0
    
    def test_projection_results_empty(self):
        """Test empty ProjectionResults."""
        results = ProjectionResults()
        assert results.get_final_portfolio_value() == 0.0
        assert results.get_total_surplus_deficit() == 0.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
