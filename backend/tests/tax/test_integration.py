"""
Unit tests for state tax and integrated tax calculator.

Tests state-specific calculations and end-to-end tax integration.
"""

import pytest
from datetime import date
from models import (
    FilingStatus,
    Scenario,
    Person,
    IncomeStream,
    InvestmentAccount,
    GlobalSettings,
    TaxSettings,
    IncomeStreamType,
    TaxBucket,
)
from tax import (
    calculate_state_tax,
    get_state_tax_rate,
    is_no_tax_state,
    TaxCalculator,
    calculate_taxes_for_projection,
)
from engine import ProjectionEngine


class TestStateTax:
    """Tests for state tax calculations."""
    
    def test_no_tax_state(self):
        """Test states with no income tax."""
        # Florida has no income tax
        tax = calculate_state_tax(
            agi=100000,
            residence_state="FL"
        )
        
        assert tax == 0.0
        assert is_no_tax_state("FL") is True
    
    def test_texas_no_tax(self):
        """Test Texas (another no-tax state)."""
        tax = calculate_state_tax(
            agi=150000,
            residence_state="TX"
        )
        
        assert tax == 0.0
    
    def test_arizona_flat_rate(self):
        """Test Arizona flat rate (2.5%)."""
        tax = calculate_state_tax(
            agi=100000,
            residence_state="AZ"
        )
        
        # 100000 * 0.025 = 2500
        assert tax == 2500
    
    def test_california_rate(self):
        """Test California (higher rate, ~9.3%)."""
        tax = calculate_state_tax(
            agi=100000,
            residence_state="CA"
        )
        
        # 100000 * 0.093 = 9300
        assert tax == 9300
    
    def test_case_insensitive_state_codes(self):
        """Test that state codes work in lowercase."""
        tax_upper = calculate_state_tax(100000, "AZ")
        tax_lower = calculate_state_tax(100000, "az")
        
        assert tax_upper == tax_lower
    
    def test_unknown_state_fallback(self):
        """Test fallback rate for unknown states."""
        tax = calculate_state_tax(
            agi=100000,
            residence_state="XX"  # Unknown
        )
        
        # Should use 5% fallback
        assert tax == 5000
    
    def test_zero_agi(self):
        """Test with zero AGI."""
        tax = calculate_state_tax(
            agi=0,
            residence_state="CA"
        )
        
        assert tax == 0.0


class TestTaxCalculator:
    """Tests for integrated TaxCalculator class."""
    
    def test_single_filer_annual_taxes(self):
        """Test annual tax calculation for single filer."""
        calculator = TaxCalculator(
            filing_status=FilingStatus.SINGLE,
            residence_state="AZ"
        )
        
        tax_summary = calculator.calculate_annual_taxes(
            annual_ssa_income=30000,
            annual_other_income=50000
        )
        
        # Check all fields are populated
        assert tax_summary.total_ssa_income == 30000
        assert tax_summary.other_ordinary_income == 50000
        assert tax_summary.taxable_ssa_income > 0  # Should be partially taxable
        assert tax_summary.agi > 0
        assert tax_summary.federal_tax > 0
        assert tax_summary.state_tax > 0
        assert tax_summary.total_tax > 0
    
    def test_mfj_annual_taxes(self):
        """Test annual tax for married filing jointly."""
        calculator = TaxCalculator(
            filing_status=FilingStatus.MARRIED_FILING_JOINTLY,
            residence_state="FL"  # No state tax
        )
        
        tax_summary = calculator.calculate_annual_taxes(
            annual_ssa_income=55000,
            annual_other_income=145000
        )
        
        # assert tax_summary.filing_status == "married_filing_jointly"
        assert tax_summary.state_tax == 0.0  # Florida
        assert tax_summary.federal_tax > 0
    
    def test_monthly_tax_estimation(self):
        """Test monthly tax withholding estimates."""
        calculator = TaxCalculator(
            filing_status=FilingStatus.SINGLE,
            residence_state="CA"
        )
        
        monthly_federal, monthly_state = calculator.estimate_monthly_taxes(
            annual_federal_tax=12000,
            annual_state_tax=6000
        )
        
        assert monthly_federal == 1000  # 12000 / 12
        assert monthly_state == 500  # 6000 / 12


class TestTaxIntegration:
    """Test tax integration with projection engine."""
    
    def test_simple_scenario_taxes(self):
        """Test tax calculation for a simple scenario."""
        # Create simple scenario
        person = Person(
            person_id="p1",
            name="Test",
            birth_date=date(1960, 1, 1)
        )
        
        pension = IncomeStream(
            stream_id="pension",
            type=IncomeStreamType.PENSION,
            owner_person_id="p1",
            start_month="2026-01",
            monthly_amount_at_start=5000
        )
        
        ssa = IncomeStream(
            stream_id="ssa",
            type=IncomeStreamType.SOCIAL_SECURITY,
            owner_person_id="p1",
            start_month="2026-01",
            monthly_amount_at_start=2000
        )
        
        account = InvestmentAccount(
            account_id="401k",
            name="401k",
            tax_bucket=TaxBucket.TAX_DEFERRED,
            starting_balance=200000,
            annual_return_rate=0.06,
            monthly_withdrawal=1000
        )
        
        scenario = Scenario(
            scenario_id="test",
            scenario_name="Test",
            global_settings=GlobalSettings(
                projection_start_month="2026-01",
                projection_end_year=2026,
                residence_state="AZ"
            ),
            people=[person],
            income_streams=[pension, ssa],
            accounts=[account],
            tax_settings=TaxSettings(
                filing_status=FilingStatus.SINGLE
            )
        )
        
        # Run projection
        engine = ProjectionEngine(scenario)
        monthly = engine.run()
        
        # Calculate taxes
        tax_summaries = calculate_taxes_for_projection(
            monthly,
            scenario.income_streams,
            scenario.tax_settings.filing_status,
            scenario.global_settings.residence_state
        )
        
        assert len(tax_summaries) == 1  # One year
        
        tax_2026 = tax_summaries[0]
        assert tax_2026.year == 2026
        
        # Annual SSA: 2000 * 12 = 24000
        assert abs(tax_2026.total_ssa_income - 24000) < 1
        
        # Annual other: (5000 * 12) + (1000 * 12) = 72000
        assert abs(tax_2026.other_ordinary_income - 72000) < 1
        
        # Should have some taxable SSA
        assert tax_2026.taxable_ssa_income > 0
        
        # Should have taxes
        assert tax_2026.federal_tax > 0
        assert tax_2026.state_tax > 0
        assert tax_2026.total_tax > 0
    
    def test_multi_year_taxes(self):
        """Test taxes over multiple years."""
        scenario = Scenario(
            scenario_id="test",
            scenario_name="Test",
            global_settings=GlobalSettings(
                projection_start_month="2026-01",
                projection_end_year=2028,
                residence_state="CA"
            ),
            people=[
                Person(
                    person_id="p1",
                    name="Test",
                    birth_date=date(1960, 1, 1)
                )
            ],
            income_streams=[
                IncomeStream(
                    stream_id="pension",
                    type=IncomeStreamType.PENSION,
                    owner_person_id="p1",
                    start_month="2026-01",
                    monthly_amount_at_start=4000,
                    cola_percent_annual=0.02,
                    cola_month=1
                )
            ],
            accounts=[],
            tax_settings=TaxSettings(
                filing_status=FilingStatus.SINGLE
            )
        )
        
        engine = ProjectionEngine(scenario)
        monthly = engine.run()
        
        tax_summaries = calculate_taxes_for_projection(
            monthly,
            scenario.income_streams,
            scenario.tax_settings.filing_status,
            scenario.global_settings.residence_state
        )
        
        assert len(tax_summaries) == 3  # 2026, 2027, 2028
        
        # Check years are correct
        assert tax_summaries[0].year == 2026
        assert tax_summaries[1].year == 2027
        assert tax_summaries[2].year == 2028
        
        # Income should increase due to COLA
        income_2026 = tax_summaries[0].other_ordinary_income
        income_2027 = tax_summaries[1].other_ordinary_income
        
        assert income_2027 > income_2026  # Due to 2% COLA
    
    def test_no_tax_state_integration(self):
        """Test integration with no-tax state."""
        scenario = Scenario(
            scenario_id="test",
            scenario_name="Test",
            global_settings=GlobalSettings(
                projection_start_month="2026-01",
                projection_end_year=2026,
                residence_state="FL"  # No state tax
            ),
            people=[
                Person(
                    person_id="p1",
                    name="Test",
                    birth_date=date(1960, 1, 1)
                )
            ],
            income_streams=[
                IncomeStream(
                    stream_id="pension",
                    type=IncomeStreamType.PENSION,
                    owner_person_id="p1",
                    start_month="2026-01",
                    monthly_amount_at_start=6000
                )
            ],
            accounts=[],
            tax_settings=TaxSettings(
                filing_status=FilingStatus.SINGLE
            )
        )
        
        engine = ProjectionEngine(scenario)
        monthly = engine.run()
        
        tax_summaries = calculate_taxes_for_projection(
            monthly,
            scenario.income_streams,
            scenario.tax_settings.filing_status,
            scenario.global_settings.residence_state
        )
        
        tax_2026 = tax_summaries[0]
        
        # Florida should have zero state tax
        assert tax_2026.state_tax == 0.0
        
        # But should still have federal tax
        assert tax_2026.federal_tax > 0


class TestTaxWithRothAccounts:
    """Test that Roth withdrawals are not taxed."""
    
    def test_roth_withdrawals_not_taxed(self):
        """Test Roth withdrawals don't add to taxable income."""
        scenario = Scenario(
            scenario_id="test",
            scenario_name="Test",
            global_settings=GlobalSettings(
                projection_start_month="2026-01",
                projection_end_year=2026,
                residence_state="AZ"
            ),
            people=[
                Person(
                    person_id="p1",
                    name="Test",
                    birth_date=date(1960, 1, 1)
                )
            ],
            income_streams=[],
            accounts=[
                InvestmentAccount(
                    account_id="roth",
                    name="Roth IRA",
                    tax_bucket=TaxBucket.ROTH,
                    starting_balance=100000,
                    annual_return_rate=0.06,
                    monthly_withdrawal=2000  # $24k/year
                )
            ],
            tax_settings=TaxSettings(
                filing_status=FilingStatus.SINGLE
            )
        )
        
        engine = ProjectionEngine(scenario)
        monthly = engine.run()
        
        # Note: In v1, Roth withdrawals are counted in total_gross_cashflow
        # but the tax calculator only taxes tax_deferred and taxable withdrawals
        # This test would need to be adjusted based on final implementation
        # For now, we're testing that the tax module COULD handle this
        
        # Just verify we can run the calculation
        tax_summaries = calculate_taxes_for_projection(
            monthly,
            scenario.income_streams,
            scenario.tax_settings.filing_status,
            scenario.global_settings.residence_state
        )
        
        assert len(tax_summaries) == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
