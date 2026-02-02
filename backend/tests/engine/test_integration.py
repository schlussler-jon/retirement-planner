"""
Integration tests for the projection engine.

Tests end-to-end projection with real scenarios.
"""

import pytest
import json
from pathlib import Path
from datetime import date
from models import (
    Scenario,
    Person,
    IncomeStream,
    InvestmentAccount,
    GlobalSettings,
    TaxSettings,
    BudgetSettings,
    FilingStatus,
    TaxBucket,
    IncomeStreamType,
)
from engine import ProjectionEngine, AnnualAggregator


class TestProjectionEngine:
    """Integration tests for ProjectionEngine."""
    
    def test_simple_projection(self):
        """Test a simple projection with one person, one income, one account."""
        person = Person(
            person_id="p1",
            name="Test Person",
            birth_date=date(1970, 1, 1),
            life_expectancy_years=85
        )
        
        income = IncomeStream(
            stream_id="pension",
            type=IncomeStreamType.PENSION,
            owner_person_id="p1",
            start_month="2026-01",
            monthly_amount_at_start=5000.0,
            cola_percent_annual=0.02,
            cola_month=1
        )
        
        account = InvestmentAccount(
            account_id="401k",
            name="401k",
            tax_bucket=TaxBucket.TAX_DEFERRED,
            starting_balance=100000.0,
            annual_return_rate=0.06
        )
        
        scenario = Scenario(
            scenario_id="test",
            scenario_name="Test",
            global_settings=GlobalSettings(
                projection_start_month="2026-01",
                projection_end_year=2026,
                residence_state="CA"
            ),
            people=[person],
            income_streams=[income],
            accounts=[account],
            tax_settings=TaxSettings(filing_status=FilingStatus.SINGLE)
        )
        
        engine = ProjectionEngine(scenario)
        projections = engine.run()
        
        # Should have 12 months (full year 2026)
        assert len(projections) == 12
        
        # Check first month
        first = projections[0]
        assert first.month == "2026-01"
        assert first.income_by_stream["pension"] == 5100.0  # 5000 * 1.02 (COLA in Jan)
        assert first.total_investments > 100000  # Should grow
        
        # Check last month
        last = projections[-1]
        assert last.month == "2026-12"
        assert last.total_investments > 100000  # Should have grown over year
    
    def test_projection_with_withdrawals(self):
        """Test projection with account withdrawals (income)."""
        account = InvestmentAccount(
            account_id="457b",
            name="457b",
            tax_bucket=TaxBucket.TAX_DEFERRED,
            starting_balance=330000.0,
            annual_return_rate=0.06,
            monthly_withdrawal=1900.0
        )
        
        scenario = Scenario(
            scenario_id="test",
            scenario_name="Test",
            global_settings=GlobalSettings(
                projection_start_month="2026-01",
                projection_end_year=2026,
                residence_state="AZ"
            ),
            people=[],
            income_streams=[],
            accounts=[account],
            tax_settings=TaxSettings(filing_status=FilingStatus.SINGLE)
        )
        
        engine = ProjectionEngine(scenario)
        projections = engine.run()
        
        # Each month should have withdrawal
        for projection in projections:
            assert projection.withdrawals_by_account["457b"] == 1900.0
            assert projection.total_gross_cashflow == 1900.0  # Withdrawal is income
        
        # Balance should decrease over time (despite growth)
        first_balance = projections[0].balances_by_account["457b"]
        last_balance = projections[-1].balances_by_account["457b"]
        
        # After 12 months of 1900/month withdrawal:
        # Total withdrawn: 22,800
        # With 6% growth, balance should be lower
        assert last_balance < first_balance
        assert last_balance > 300000  # But not depleted
    
    def test_multi_year_projection(self):
        """Test projection spanning multiple years."""
        income = IncomeStream(
            stream_id="pension",
            type=IncomeStreamType.PENSION,
            owner_person_id="p1",
            start_month="2026-01",
            monthly_amount_at_start=3000.0,
            cola_percent_annual=0.03,
            cola_month=5  # May
        )
        
        scenario = Scenario(
            scenario_id="test",
            scenario_name="Test",
            global_settings=GlobalSettings(
                projection_start_month="2026-01",
                projection_end_year=2028,  # 3 years
                residence_state="CA"
            ),
            people=[Person(
                person_id="p1",
                name="Test",
                birth_date=date(1970, 1, 1)
            )],
            income_streams=[income],
            accounts=[],
            tax_settings=TaxSettings(filing_status=FilingStatus.SINGLE)
        )
        
        engine = ProjectionEngine(scenario)
        projections = engine.run()
        
        # Should have 36 months (3 years)
        assert len(projections) == 36
        
        # Check COLA progression
        # 2026-04 (before May): 3000
        april_2026 = next(p for p in projections if p.month == "2026-04")
        assert april_2026.income_by_stream["pension"] == 3000.0
        
        # 2026-05 (May): 3000 * 1.03 = 3090
        may_2026 = next(p for p in projections if p.month == "2026-05")
        assert abs(may_2026.income_by_stream["pension"] - 3090.0) < 0.01
        
        # 2027-05 (next May): 3090 * 1.03 = 3182.7
        may_2027 = next(p for p in projections if p.month == "2027-05")
        assert abs(may_2027.income_by_stream["pension"] - 3182.7) < 0.01
        
        # 2028-05 (third May): 3182.7 * 1.03 = 3278.18
        may_2028 = next(p for p in projections if p.month == "2028-05")
        assert abs(may_2028.income_by_stream["pension"] - 3278.18) < 0.1
    
    def test_income_stream_starting_mid_projection(self):
        """Test income stream that starts after projection begins."""
        early_income = IncomeStream(
            stream_id="early",
            type=IncomeStreamType.PENSION,
            owner_person_id="p1",
            start_month="2026-01",
            monthly_amount_at_start=2000.0
        )
        
        late_income = IncomeStream(
            stream_id="late",
            type=IncomeStreamType.SOCIAL_SECURITY,
            owner_person_id="p1",
            start_month="2028-09",  # Starts in Sept 2028
            monthly_amount_at_start=1500.0
        )
        
        scenario = Scenario(
            scenario_id="test",
            scenario_name="Test",
            global_settings=GlobalSettings(
                projection_start_month="2026-01",
                projection_end_year=2029,
                residence_state="CA"
            ),
            people=[Person(
                person_id="p1",
                name="Test",
                birth_date=date(1970, 1, 1)
            )],
            income_streams=[early_income, late_income],
            accounts=[],
            tax_settings=TaxSettings(filing_status=FilingStatus.SINGLE)
        )
        
        engine = ProjectionEngine(scenario)
        projections = engine.run()
        
        # Before late income starts
        aug_2028 = next(p for p in projections if p.month == "2028-08")
        assert aug_2028.income_by_stream["early"] == 2000.0
        assert aug_2028.income_by_stream["late"] == 0.0
        assert aug_2028.total_gross_cashflow == 2000.0
        
        # When late income starts
        sept_2028 = next(p for p in projections if p.month == "2028-09")
        assert sept_2028.income_by_stream["early"] == 2000.0
        assert sept_2028.income_by_stream["late"] == 1500.0
        assert sept_2028.total_gross_cashflow == 3500.0
    
    def test_annual_aggregation(self):
        """Test annual rollup from monthly projections."""
        account = InvestmentAccount(
            account_id="test",
            name="Test",
            tax_bucket=TaxBucket.TAXABLE,
            starting_balance=100000.0,
            annual_return_rate=0.06,
            monthly_withdrawal=500.0
        )
        
        scenario = Scenario(
            scenario_id="test",
            scenario_name="Test",
            global_settings=GlobalSettings(
                projection_start_month="2026-01",
                projection_end_year=2028,
                residence_state="CA"
            ),
            people=[],
            income_streams=[],
            accounts=[account],
            tax_settings=TaxSettings(filing_status=FilingStatus.SINGLE)
        )
        
        engine = ProjectionEngine(scenario)
        monthly = engine.run()
        
        aggregator = AnnualAggregator(monthly)
        annual = aggregator.aggregate()
        
        # Should have 3 years
        assert len(annual) == 3
        
        # Check 2026
        summary_2026 = annual[0]
        assert summary_2026.year == 2026
        assert summary_2026.total_income_year == 6000.0  # 500 * 12
        assert summary_2026.end_of_year_total_investments < 100000  # Declining
        
        # 2027
        assert annual[1].year == 2027
        
        # 2028
        assert annual[2].year == 2028


class TestExampleScenario:
    """Test using the example scenario from the Excel workbook."""
    
    def test_load_example_scenario(self):
        """Test loading and running the example scenario."""
        # Load example scenario
        example_path = Path(__file__).parent.parent.parent / "schemas" / "example_scenario.json"
        
        if not example_path.exists():
            pytest.skip("Example scenario not found")
        
        with open(example_path) as f:
            data = json.load(f)
        
        scenario = Scenario(**data)
        scenario.validate_references()
        
        # Run projection for just 1 year for speed
        scenario.global_settings.projection_end_year = 2026
        
        engine = ProjectionEngine(scenario)
        projections = engine.run()
        
        # Should have 12 months
        assert len(projections) == 12
        
        # Check first month has expected income
        first = projections[0]
        
        # Should have Jon's pension, Rebecca's pension, Jon's SSA
        # (Rebecca's SSA starts in 2028-09)
        assert "jon_pension" in first.income_by_stream
        assert "rebecca_pension" in first.income_by_stream
        assert "jon_ssa" in first.income_by_stream
        
        # Jon's 457b has withdrawal
        assert first.withdrawals_by_account["jon_457b"] == 1900.0
        
        # Total investments should be sum of all 6 accounts
        assert first.total_investments > 1200000  # ~1.2M starting
    
    def test_filing_status_change_on_death(self):
        """Test filing status changes when someone passes away."""
        person1 = Person(
            person_id="p1",
            name="Person 1",
            birth_date=date(1960, 1, 1),
            life_expectancy_years=67  # Dies in 2027
        )
        
        person2 = Person(
            person_id="p2",
            name="Person 2",
            birth_date=date(1965, 1, 1),
            life_expectancy_years=90
        )
        
        scenario = Scenario(
            scenario_id="test",
            scenario_name="Test",
            global_settings=GlobalSettings(
                projection_start_month="2026-01",
                projection_end_year=2029,
                residence_state="CA"
            ),
            people=[person1, person2],
            income_streams=[],
            accounts=[],
            tax_settings=TaxSettings(filing_status=FilingStatus.MARRIED_FILING_JOINTLY)
        )
        
        engine = ProjectionEngine(scenario)
        projections = engine.run()
        
        # 2026: Both alive, married filing jointly
        proj_2026 = next(p for p in projections if p.month == "2026-06")
        assert proj_2026.filing_status == "married_filing_jointly"
        
        # 2027: Person 1 dies (expected death: 2027-01)
        # Still married filing jointly in 2027
        proj_2027 = next(p for p in projections if p.month == "2027-06")
        assert proj_2027.filing_status == "married_filing_jointly"
        
        # 2028: After death year, switches to single
        proj_2028 = next(p for p in projections if p.month == "2028-06")
        assert proj_2028.filing_status == "single"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
