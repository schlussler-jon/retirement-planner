"""
Unit tests for projection engine.

Tests the core monthly projection logic including:
- Income stream timing and COLA
- Account contributions and withdrawals
- Growth calculations
- Operation order
"""

import pytest
from datetime import date
from app.models.scenario import (
    ScenarioInputs, Person, IncomeStream, InvestmentAccount,
    BudgetCategory, BudgetSettings, TaxSettings,
    IncomeStreamType, TaxBucket, FilingStatus
)
from app.engine.projection import run_projection, ProjectionEngine


def create_basic_scenario() -> ScenarioInputs:
    """Create a basic test scenario."""
    return ScenarioInputs(
        projection_start_month="2026-01",
        projection_end_year=2027,
        people=[
            Person(
                person_id="person_1",
                name="John Doe",
                birth_date=date(1960, 1, 1)
            )
        ],
        income_streams=[],
        investment_accounts=[],
        budget_categories=[
            BudgetCategory(
                category_name="Housing",
                fixed_or_flexible="fixed",
                monthly_amount=2000.0,
                include=True
            )
        ],
        budget_settings=BudgetSettings(),
        tax_settings=TaxSettings(
            filing_status=FilingStatus.SINGLE,
            residence_state="CA"
        )
    )


class TestProjectionEngine:
    """Test suite for ProjectionEngine."""
    
    def test_basic_projection(self):
        """Test basic projection with no income or accounts."""
        scenario = create_basic_scenario()
        results = run_projection(scenario)
        
        # Should have 24 months (Jan 2026 - Dec 2027)
        assert len(results) == 24
        
        # Check first month
        first_month = results[0]
        assert first_month['month'] == '2026-01'
        assert first_month['total_investments'] == 0.0
        assert first_month['total_gross_cashflow'] == 0.0
    
    def test_income_stream_absolute_start(self):
        """Test income stream with absolute start date."""
        scenario = create_basic_scenario()
        
        # Add pension starting in March 2026
        scenario.income_streams.append(
            IncomeStream(
                stream_id="pension_1",
                name="Test Pension",
                type=IncomeStreamType.PENSION,
                owner_person_id="person_1",
                start_month="2026-03",
                monthly_amount_at_start=5000.0,
                cola_percent_annual=0.0,
                cola_month=1
            )
        )
        
        results = run_projection(scenario)
        
        # Check that income is 0 in January and February
        assert results[0]['income_by_stream'].get('pension_1', 0.0) == 0.0
        assert results[1]['income_by_stream'].get('pension_1', 0.0) == 0.0
        
        # Check that income starts in March (month index 2)
        assert results[2]['income_by_stream']['pension_1'] == 5000.0
        assert results[2]['total_gross_cashflow'] == 5000.0
    
    def test_income_stream_age_based_start(self):
        """Test income stream with age-based start."""
        scenario = create_basic_scenario()
        
        # Person born Jan 1, 1960 will be 66 in 2026
        # Add Social Security starting at age 67
        scenario.income_streams.append(
            IncomeStream(
                stream_id="ss_1",
                name="Social Security",
                type=IncomeStreamType.SOCIAL_SECURITY,
                owner_person_id="person_1",
                start_age=67,
                monthly_amount_at_start=3000.0,
                cola_percent_annual=0.0,
                cola_month=1
            )
        )
        
        results = run_projection(scenario)
        
        # At age 67 (year 2027), SS should start
        # January 2027 is month index 12
        assert results[11]['income_by_stream'].get('ss_1', 0.0) == 0.0  # Dec 2026, age 66
        assert results[12]['income_by_stream']['ss_1'] == 3000.0  # Jan 2027, age 67
    
    def test_cola_application(self):
        """Test COLA application in specified month."""
        scenario = create_basic_scenario()
        scenario.projection_end_year = 2028  # 3 years to see multiple COLAs
        
        # Add pension with 2% COLA applied in January
        scenario.income_streams.append(
            IncomeStream(
                stream_id="pension_1",
                name="Test Pension",
                type=IncomeStreamType.PENSION,
                owner_person_id="person_1",
                start_month="2026-01",
                monthly_amount_at_start=5000.0,
                cola_percent_annual=0.02,
                cola_month=1  # January
            )
        )
        
        results = run_projection(scenario)
        
        # Initial amount in Jan 2026
        assert results[0]['income_by_stream']['pension_1'] == 5000.0
        
        # Should stay same through 2026
        assert results[11]['income_by_stream']['pension_1'] == 5000.0  # Dec 2026
        
        # Should increase by 2% in Jan 2027
        jan_2027_amount = results[12]['income_by_stream']['pension_1']
        assert abs(jan_2027_amount - 5100.0) < 0.01  # 5000 * 1.02
        
        # Should stay same through 2027
        assert abs(results[23]['income_by_stream']['pension_1'] - 5100.0) < 0.01
        
        # Should increase again in Jan 2028
        jan_2028_amount = results[24]['income_by_stream']['pension_1']
        assert abs(jan_2028_amount - 5202.0) < 0.01  # 5100 * 1.02
    
    def test_account_growth(self):
        """Test account growth calculation."""
        scenario = create_basic_scenario()
        
        # Add account with 6% annual return
        scenario.investment_accounts.append(
            InvestmentAccount(
                account_id="401k_1",
                name="401k",
                tax_bucket=TaxBucket.TAX_DEFERRED,
                starting_balance=100000.0,
                annual_return_rate_fixed=0.06,
                monthly_contribution=0.0,
                monthly_withdrawal=0.0
            )
        )
        
        results = run_projection(scenario)
        
        # Calculate expected monthly rate
        monthly_rate = (1.06 ** (1/12)) - 1
        expected_balance = 100000.0 * (1 + monthly_rate)
        
        # Check first month growth
        actual_balance = results[0]['balances_by_account']['401k_1']
        assert abs(actual_balance - expected_balance) < 0.01
        
        # Check compound growth over year
        # After 12 months at 6% annual: 100000 * 1.06 = 106000
        year_end_balance = results[11]['balances_by_account']['401k_1']
        assert abs(year_end_balance - 106000.0) < 10.0  # Allow small rounding
    
    def test_withdrawals(self):
        """Test account withdrawals."""
        scenario = create_basic_scenario()
        
        # Add account with monthly withdrawal
        scenario.investment_accounts.append(
            InvestmentAccount(
                account_id="401k_1",
                name="401k",
                tax_bucket=TaxBucket.TAX_DEFERRED,
                starting_balance=100000.0,
                annual_return_rate_fixed=0.06,
                monthly_contribution=0.0,
                monthly_withdrawal=2000.0
            )
        )
        
        results = run_projection(scenario)
        
        # First month operations:
        # 1. Contributions: 0
        # 2. Withdrawals: -2000
        # 3. Growth: (100000 - 2000) * 1.00487 (monthly rate)
        
        monthly_rate = (1.06 ** (1/12)) - 1
        expected_balance = (100000.0 - 2000.0) * (1 + monthly_rate)
        
        actual_balance = results[0]['balances_by_account']['401k_1']
        assert abs(actual_balance - expected_balance) < 0.01
        
        # Withdrawal should be counted as income
        assert results[0]['withdrawals_by_account']['401k_1'] == 2000.0
        assert results[0]['total_gross_cashflow'] == 2000.0
    
    def test_operation_order(self):
        """Test that operations happen in correct order."""
        scenario = create_basic_scenario()
        
        # Add account with contribution, withdrawal, and growth
        scenario.investment_accounts.append(
            InvestmentAccount(
                account_id="401k_1",
                name="401k",
                tax_bucket=TaxBucket.TAX_DEFERRED,
                starting_balance=10000.0,
                annual_return_rate_fixed=0.12,  # 1% per month for easy math
                monthly_contribution=1000.0,
                monthly_withdrawal=500.0
            )
        )
        
        results = run_projection(scenario)
        
        # Order should be:
        # 1. Start: 10000
        # 2. Contribution: +1000 = 11000
        # 3. Withdrawal: -500 = 10500
        # 4. Growth: 10500 * 1.01 = 10605
        
        monthly_rate = (1.12 ** (1/12)) - 1
        expected_balance = (10000.0 + 1000.0 - 500.0) * (1 + monthly_rate)
        
        actual_balance = results[0]['balances_by_account']['401k_1']
        assert abs(actual_balance - expected_balance) < 0.01
    
    def test_multiple_accounts_tax_buckets(self):
        """Test tracking across multiple accounts and tax buckets."""
        scenario = create_basic_scenario()
        
        scenario.investment_accounts.extend([
            InvestmentAccount(
                account_id="401k",
                name="401k",
                tax_bucket=TaxBucket.TAX_DEFERRED,
                starting_balance=100000.0,
                annual_return_rate_fixed=0.06,
                monthly_withdrawal=1000.0
            ),
            InvestmentAccount(
                account_id="roth",
                name="Roth IRA",
                tax_bucket=TaxBucket.ROTH,
                starting_balance=50000.0,
                annual_return_rate_fixed=0.06,
                monthly_withdrawal=500.0
            ),
            InvestmentAccount(
                account_id="taxable",
                name="Brokerage",
                tax_bucket=TaxBucket.TAXABLE,
                starting_balance=75000.0,
                annual_return_rate_fixed=0.08,
                monthly_withdrawal=0.0
            )
        ])
        
        results = run_projection(scenario)
        
        first_month = results[0]
        
        # Check withdrawals by bucket
        assert first_month['withdrawals_by_tax_bucket']['tax_deferred'] == 1000.0
        assert first_month['withdrawals_by_tax_bucket']['roth'] == 500.0
        assert first_month['withdrawals_by_tax_bucket']['taxable'] == 0.0
        
        # Check total investments
        total_balance = (
            first_month['balances_by_account']['401k'] +
            first_month['balances_by_account']['roth'] +
            first_month['balances_by_account']['taxable']
        )
        assert abs(first_month['total_investments'] - total_balance) < 0.01


class TestEdgeCases:
    """Test edge cases and boundary conditions."""
    
    def test_empty_scenario(self):
        """Test scenario with no income or accounts."""
        scenario = create_basic_scenario()
        results = run_projection(scenario)
        
        assert len(results) > 0
        assert all(r['total_gross_cashflow'] == 0.0 for r in results)
        assert all(r['total_investments'] == 0.0 for r in results)
    
    def test_account_depletion(self):
        """Test withdrawal larger than balance."""
        scenario = create_basic_scenario()
        
        # Small account with large withdrawal
        scenario.investment_accounts.append(
            InvestmentAccount(
                account_id="small",
                name="Small Account",
                tax_bucket=TaxBucket.TAXABLE,
                starting_balance=1000.0,
                annual_return_rate_fixed=0.0,
                monthly_withdrawal=500.0
            )
        )
        
        results = run_projection(scenario)
        
        # First month: withdraw 500, balance = 500
        assert abs(results[0]['balances_by_account']['small'] - 500.0) < 0.01
        
        # Second month: withdraw 500, balance = 0
        assert abs(results[1]['balances_by_account']['small']) < 0.01
        
        # Third month: can't withdraw (balance is 0)
        # Withdrawal should be min(500, 0) = 0
        assert results[2]['withdrawals_by_account'].get('small', 0.0) == 0.0
