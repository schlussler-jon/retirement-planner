#!/usr/bin/env python3
"""
Phase 2 Validation Script

This script validates that the projection engine is working correctly.
Run this after installing dependencies to verify your setup.
"""

import sys
import json
from pathlib import Path
from datetime import date

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from models import (
    Scenario,
    Person,
    IncomeStream,
    InvestmentAccount,
    GlobalSettings,
    TaxSettings,
    FilingStatus,
    TaxBucket,
    IncomeStreamType,
)
from engine import (
    ProjectionEngine,
    AnnualAggregator,
    Timeline,
    IncomeProcessor,
    AccountProcessor,
)


def test_timeline():
    """Test timeline generation."""
    print("✓ Testing Timeline...")
    
    timeline = Timeline("2026-01", 2028)
    months = list(timeline.months())
    
    assert len(months) == 36, f"Expected 36 months, got {len(months)}"
    assert months[0][0] == "2026-01"
    assert months[-1][0] == "2028-12"
    
    print(f"  ✓ Timeline: {len(months)} months from {months[0][0]} to {months[-1][0]}")


def test_cola_logic():
    """Test COLA application."""
    print("✓ Testing COLA Logic...")
    
    stream = IncomeStream(
        stream_id="test_pension",
        type=IncomeStreamType.PENSION,
        owner_person_id="p1",
        start_month="2026-01",
        monthly_amount_at_start=1000.0,
        cola_percent_annual=0.02,
        cola_month=5  # May
    )
    
    processor = IncomeProcessor([stream])
    
    # January - no COLA yet
    income_jan = processor.process_month("2026-01", 1)
    assert income_jan["test_pension"] == 1000.0
    
    # May - COLA applied
    income_may = processor.process_month("2026-05", 5)
    expected = 1000.0 * 1.02
    assert abs(income_may["test_pension"] - expected) < 0.01
    
    print(f"  ✓ COLA: $1,000 → ${income_may['test_pension']:.2f} in May")


def test_account_operations():
    """Test account contributions, withdrawals, and growth."""
    print("✓ Testing Account Operations...")
    
    account = InvestmentAccount(
        account_id="test_401k",
        name="Test 401k",
        tax_bucket=TaxBucket.TAX_DEFERRED,
        starting_balance=100000.0,
        annual_return_rate=0.06,
        monthly_contribution=500.0,
        monthly_withdrawal=300.0
    )
    
    processor = AccountProcessor([account])
    withdrawals, balances = processor.process_month()
    
    assert withdrawals["test_401k"] == 300.0
    
    # Balance: 100000 + 500 - 300 = 100200, then growth
    expected_balance = 100200.0 * (1.06 ** (1/12))
    assert abs(balances["test_401k"] - expected_balance) < 1.0
    
    print(f"  ✓ Operations: Start=$100,000, End=${balances['test_401k']:,.2f}")
    print(f"  ✓ Withdrawal (income): ${withdrawals['test_401k']:.2f}")


def test_simple_projection():
    """Test running a simple projection."""
    print("✓ Testing Projection Engine...")
    
    person = Person(
        person_id="p1",
        name="Test Person",
        birth_date=date(1970, 1, 1),
        life_expectancy_years=90
    )
    
    income = IncomeStream(
        stream_id="pension",
        type=IncomeStreamType.PENSION,
        owner_person_id="p1",
        start_month="2026-01",
        monthly_amount_at_start=3000.0,
        cola_percent_annual=0.02,
        cola_month=1
    )
    
    account = InvestmentAccount(
        account_id="savings",
        name="Savings",
        tax_bucket=TaxBucket.TAXABLE,
        starting_balance=100000.0,
        annual_return_rate=0.05
    )
    
    scenario = Scenario(
        scenario_id="test",
        scenario_name="Test Scenario",
        global_settings=GlobalSettings(
            projection_start_month="2026-01",
            projection_end_year=2030,
            residence_state="CA"
        ),
        people=[person],
        income_streams=[income],
        accounts=[account],
        tax_settings=TaxSettings(filing_status=FilingStatus.SINGLE)
    )
    
    engine = ProjectionEngine(scenario)
    projections = engine.run()
    
    assert len(projections) == 60, f"Expected 60 months, got {len(projections)}"
    
    first = projections[0]
    last = projections[-1]
    
    print(f"  ✓ Projection: {len(projections)} months")
    print(f"  ✓ First month ({first.month}): Income=${first.total_gross_cashflow:,.2f}, "
          f"Portfolio=${first.total_investments:,.2f}")
    print(f"  ✓ Last month ({last.month}): Income=${last.total_gross_cashflow:,.2f}, "
          f"Portfolio=${last.total_investments:,.2f}")


def test_annual_aggregation():
    """Test annual rollup."""
    print("✓ Testing Annual Aggregation...")
    
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
        accounts=[
            InvestmentAccount(
                account_id="test",
                name="Test",
                tax_bucket=TaxBucket.TAXABLE,
                starting_balance=100000.0,
                annual_return_rate=0.06,
                monthly_withdrawal=500.0
            )
        ],
        tax_settings=TaxSettings(filing_status=FilingStatus.SINGLE)
    )
    
    engine = ProjectionEngine(scenario)
    monthly = engine.run()
    
    aggregator = AnnualAggregator(monthly)
    annual = aggregator.aggregate()
    
    assert len(annual) == 3, f"Expected 3 years, got {len(annual)}"
    assert annual[0].year == 2026
    assert annual[1].year == 2027
    assert annual[2].year == 2028
    
    print(f"  ✓ Annual summaries: {len(annual)} years")
    for summary in annual:
        print(f"    Year {summary.year}: Income=${summary.total_income_year:,.0f}, "
              f"Portfolio=${summary.end_of_year_total_investments:,.0f}")


def test_example_scenario():
    """Test loading and running the example scenario."""
    print("✓ Testing Example Scenario...")
    
    example_path = Path(__file__).parent / "schemas" / "example_scenario.json"
    
    if not example_path.exists():
        print("  ⚠ Example scenario not found, skipping")
        return
    
    with open(example_path) as f:
        data = json.load(f)
    
    scenario = Scenario(**data)
    scenario.validate_references()
    
    # Run for just one year for speed
    scenario.global_settings.projection_end_year = 2026
    
    engine = ProjectionEngine(scenario)
    projections = engine.run()
    
    assert len(projections) == 12
    
    first = projections[0]
    print(f"  ✓ Example scenario: '{scenario.scenario_name}'")
    print(f"  ✓ People: {[p.name for p in scenario.people]}")
    print(f"  ✓ Streams: {len(scenario.income_streams)}, Accounts: {len(scenario.accounts)}")
    print(f"  ✓ First month income: ${first.total_gross_cashflow:,.2f}")
    print(f"  ✓ Starting portfolio: ${first.total_investments:,.2f}")


def main():
    """Run all validation tests."""
    print("=" * 70)
    print("PHASE 2 VALIDATION - Projection Engine Core")
    print("=" * 70)
    print()
    
    try:
        test_timeline()
        print()
        
        test_cola_logic()
        print()
        
        test_account_operations()
        print()
        
        test_simple_projection()
        print()
        
        test_annual_aggregation()
        print()
        
        test_example_scenario()
        print()
        
        print("=" * 70)
        print("✅ ALL VALIDATION TESTS PASSED!")
        print("=" * 70)
        print()
        print("Phase 2 is ready. You can now:")
        print("  1. Run unit tests: pytest tests/engine/ -v")
        print("  2. Check coverage: pytest tests/engine/ --cov=engine --cov-report=html")
        print("  3. Move to Phase 3: Tax Calculation Module")
        print()
        
        return 0
        
    except Exception as e:
        print()
        print("=" * 70)
        print("❌ VALIDATION FAILED!")
        print("=" * 70)
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
