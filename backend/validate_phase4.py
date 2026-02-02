#!/usr/bin/env python3
"""
Phase 4 Validation Script

This script validates that the budget and net income module is working correctly.
Run this after installing dependencies to verify your setup.
"""

import sys
from pathlib import Path
from datetime import date

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from models import (
    Scenario, Person, IncomeStream, InvestmentAccount,
    GlobalSettings, TaxSettings, BudgetSettings, BudgetCategory,
    FilingStatus, IncomeStreamType, TaxBucket
)
from engine import ProjectionEngine
from tax import calculate_taxes_for_projection
from budget import BudgetProcessor, calculate_net_income_projections, get_financial_summary


def test_budget_inflation():
    """Test budget inflation calculation."""
    print("✓ Testing Budget Inflation...")
    
    budget = BudgetSettings(
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
        inflation_annual_percent=0.03  # 3%
    )
    
    processor = BudgetProcessor(budget, [])
    
    # December 2026 - no inflation yet
    spending_dec = processor.process_month("2026-12", 12)
    assert spending_dec == 2800
    print(f"  ✓ Dec 2026: ${spending_dec:,.0f}")
    
    # January 2027 - inflation applied
    spending_jan = processor.process_month("2027-01", 1)
    expected = 2800 * 1.03  # 2884
    assert abs(spending_jan - expected) < 1
    print(f"  ✓ Jan 2027 (after 3% inflation): ${spending_jan:,.0f}")


def test_survivor_reduction():
    """Test survivor spending reduction."""
    print("✓ Testing Survivor Reduction...")
    
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
    
    budget = BudgetSettings(
        categories=[
            BudgetCategory(
                category_name="Housing",
                category_type="fixed",
                monthly_amount=3000,
                include=True
            ),
            BudgetCategory(
                category_name="Food",
                category_type="flexible",
                monthly_amount=1200,
                include=True
            ),
        ],
        inflation_annual_percent=0.0,
        survivor_flexible_reduction_percent=0.25,  # 25% reduction
        survivor_reduction_mode="flex_only"
    )
    
    processor = BudgetProcessor(budget, people)
    
    # Before death
    spending_before = processor.process_month("2026-12", 12)
    assert spending_before == 4200  # 3000 + 1200
    print(f"  ✓ Before death: ${spending_before:,.0f}")
    
    # After death (2027-01)
    spending_after = processor.process_month("2027-01", 1)
    # Fixed stays same: 3000
    # Flexible reduced 25%: 1200 * 0.75 = 900
    # Total: 3900
    assert abs(spending_after - 3900) < 1
    print(f"  ✓ After death (25% flex reduction): ${spending_after:,.0f}")


def test_net_income_calculation():
    """Test net income projection calculation."""
    print("✓ Testing Net Income Calculation...")
    
    # Create simple scenario
    person = Person(
        person_id="p1",
        name="Test Person",
        birth_date=date(1960, 1, 1)
    )
    
    pension = IncomeStream(
        stream_id="pension",
        type=IncomeStreamType.PENSION,
        owner_person_id="p1",
        start_month="2026-01",
        monthly_amount_at_start=6000
    )
    
    budget = BudgetSettings(
        categories=[
            BudgetCategory(
                category_name="Spending",
                category_type="fixed",
                monthly_amount=4000,
                include=True
            ),
        ],
        inflation_annual_percent=0.0
    )
    
    scenario = Scenario(
        scenario_id="test",
        scenario_name="Test",
        global_settings=GlobalSettings(
            projection_start_month="2026-01",
            projection_end_year=2026,
            residence_state="FL"  # No state tax
        ),
        people=[person],
        income_streams=[pension],
        accounts=[],
        budget_settings=budget,
        tax_settings=TaxSettings(
            filing_status=FilingStatus.SINGLE
        )
    )
    
    # Run projection
    engine = ProjectionEngine(scenario)
    monthly = engine.run()
    
    # Calculate taxes
    taxes = calculate_taxes_for_projection(
        monthly,
        scenario.income_streams,
        scenario.tax_settings.filing_status,
        scenario.global_settings.residence_state
    )
    
    # Process budget
    budget_processor = BudgetProcessor(scenario.budget_settings, scenario.people)
    spending = []
    for proj in monthly:
        month_num = int(proj.month.split('-')[1])
        spending.append(budget_processor.process_month(proj.month, month_num))
    
    # Calculate net income
    net_income = calculate_net_income_projections(monthly, taxes, spending)
    
    print(f"  ✓ Generated {len(net_income)} monthly projections")
    
    first = net_income[0]
    print(f"  ✓ Jan 2026:")
    print(f"    Gross Income: ${first.gross_cashflow:,.0f}")
    print(f"    Estimated Tax: ${first.estimated_total_tax:,.0f}")
    print(f"    Net Income: ${first.net_income_after_tax:,.0f}")
    print(f"    Spending: ${first.inflation_adjusted_spending:,.0f}")
    print(f"    Surplus: ${first.surplus_deficit:,.0f}")
    
    # Should have surplus
    assert first.surplus_deficit > 0


def test_complete_scenario():
    """Test complete retirement scenario."""
    print("✓ Testing Complete Scenario...")
    
    # Create realistic scenario
    person = Person(
        person_id="p1",
        name="Test Person",
        birth_date=date(1960, 1, 1)
    )
    
    pension = IncomeStream(
        stream_id="pension",
        type=IncomeStreamType.PENSION,
        owner_person_id="p1",
        start_month="2026-01",
        monthly_amount_at_start=5000,
        cola_percent_annual=0.02,
        cola_month=1
    )
    
    ssa = IncomeStream(
        stream_id="ssa",
        type=IncomeStreamType.SOCIAL_SECURITY,
        owner_person_id="p1",
        start_month="2026-01",
        monthly_amount_at_start=2500,
        cola_percent_annual=0.025,
        cola_month=1
    )
    
    account = InvestmentAccount(
        account_id="401k",
        name="401k",
        tax_bucket=TaxBucket.TAX_DEFERRED,
        starting_balance=300000,
        annual_return_rate=0.06,
        monthly_withdrawal=1500
    )
    
    budget = BudgetSettings(
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
                monthly_amount=500,
                include=True
            ),
        ],
        inflation_annual_percent=0.03
    )
    
    scenario = Scenario(
        scenario_id="test",
        scenario_name="Complete Test",
        global_settings=GlobalSettings(
            projection_start_month="2026-01",
            projection_end_year=2028,
            residence_state="AZ"
        ),
        people=[person],
        income_streams=[pension, ssa],
        accounts=[account],
        budget_settings=budget,
        tax_settings=TaxSettings(
            filing_status=FilingStatus.SINGLE
        )
    )
    
    # Phase 2: Projection
    engine = ProjectionEngine(scenario)
    monthly = engine.run()
    print(f"  ✓ Projection: {len(monthly)} months")
    
    # Phase 3: Taxes
    taxes = calculate_taxes_for_projection(
        monthly,
        scenario.income_streams,
        scenario.tax_settings.filing_status,
        scenario.global_settings.residence_state
    )
    print(f"  ✓ Taxes: {len(taxes)} years")
    
    # Phase 4a: Budget
    budget_processor = BudgetProcessor(scenario.budget_settings, scenario.people)
    spending = []
    for proj in monthly:
        month_num = int(proj.month.split('-')[1])
        spending.append(budget_processor.process_month(proj.month, month_num))
    print(f"  ✓ Budget: {len(spending)} months")
    
    # Phase 4b: Net Income
    net_income = calculate_net_income_projections(monthly, taxes, spending)
    print(f"  ✓ Net Income: {len(net_income)} projections")
    
    # Get summary
    summary = get_financial_summary(net_income)
    print(f"\n  Summary:")
    print(f"    Total Gross Income: ${summary['total_gross_income']:,.0f}")
    print(f"    Total Taxes: ${summary['total_taxes']:,.0f}")
    print(f"    Total Spending: ${summary['total_spending']:,.0f}")
    print(f"    Total Surplus: ${summary['total_surplus_deficit']:,.0f}")
    print(f"    Months in Surplus: {summary['months_in_surplus']}")
    print(f"    Months in Deficit: {summary['months_in_deficit']}")


def main():
    """Run all validation tests."""
    print("=" * 70)
    print("PHASE 4 VALIDATION - Net Income & Budget")
    print("=" * 70)
    print()
    
    try:
        test_budget_inflation()
        print()
        
        test_survivor_reduction()
        print()
        
        test_net_income_calculation()
        print()
        
        test_complete_scenario()
        print()
        
        print("=" * 70)
        print("✅ ALL VALIDATION TESTS PASSED!")
        print("=" * 70)
        print()
        print("Phase 4 is ready. You can now:")
        print("  1. Run unit tests: pytest tests/budget/ -v")
        print("  2. Check coverage: pytest tests/budget/ --cov=budget --cov-report=html")
        print("  3. Move to Phase 5: API Endpoints")
        print()
        print("🎉 Phases 1-4 Complete!")
        print("   You now have a complete retirement planning calculation engine!")
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
