#!/usr/bin/env python3
"""
Phase 1 Validation Script

This script validates that all Phase 1 models are working correctly.
Run this after installing dependencies to verify your setup.
"""

import sys
import json
from datetime import date
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from models import (
    Person,
    IncomeStream,
    InvestmentAccount,
    GlobalSettings,
    BudgetSettings,
    BudgetCategory,
    TaxSettings,
    Scenario,
    FilingStatus,
    TaxBucket,
    IncomeStreamType,
    CategoryType,
)


def test_person_creation():
    """Test creating a Person."""
    print("✓ Testing Person model...")
    person = Person(
        person_id="test_person",
        name="Test User",
        birth_date=date(1970, 1, 1),
        life_expectancy_years=85
    )
    assert person.death_year_month == "2055-01"
    print(f"  ✓ Person created: {person.name}, death year-month: {person.death_year_month}")


def test_income_stream_creation():
    """Test creating an IncomeStream."""
    print("✓ Testing IncomeStream model...")
    stream = IncomeStream(
        stream_id="test_pension",
        type=IncomeStreamType.PENSION,
        owner_person_id="test_person",
        start_month="2026-01",
        monthly_amount_at_start=5000.0,
        cola_percent_annual=0.02,
        cola_month=5
    )
    print(f"  ✓ Income stream created: ${stream.monthly_amount_at_start}/month, {stream.cola_percent_annual*100}% COLA")


def test_investment_account_creation():
    """Test creating an InvestmentAccount."""
    print("✓ Testing InvestmentAccount model...")
    account = InvestmentAccount(
        account_id="test_401k",
        name="Test 401k",
        tax_bucket=TaxBucket.TAX_DEFERRED,
        starting_balance=100000.0,
        annual_return_rate=0.07,
        monthly_contribution=500.0,
        monthly_withdrawal=0.0
    )
    print(f"  ✓ Account created: ${account.starting_balance:,.2f}, {account.annual_return_rate*100}% annual return")
    print(f"  ✓ Monthly return rate: {account.monthly_return_rate*100:.4f}%")


def test_budget_creation():
    """Test creating BudgetSettings."""
    print("✓ Testing BudgetSettings model...")
    budget = BudgetSettings(
        categories=[
            BudgetCategory(
                category_name="Housing",
                category_type=CategoryType.FIXED,
                monthly_amount=2000.0
            ),
            BudgetCategory(
                category_name="Travel",
                category_type=CategoryType.FLEXIBLE,
                monthly_amount=500.0
            )
        ],
        inflation_annual_percent=0.03
    )
    print(f"  ✓ Budget created: ${budget.total_monthly_spending():,.2f}/month")
    print(f"  ✓ Fixed: ${budget.total_fixed_spending():,.2f}, Flexible: ${budget.total_flexible_spending():,.2f}")


def test_scenario_creation():
    """Test creating a complete Scenario."""
    print("✓ Testing Scenario model...")
    
    person = Person(
        person_id="p1",
        name="Test User",
        birth_date=date(1970, 1, 1),
        life_expectancy_years=85
    )
    
    stream = IncomeStream(
        stream_id="s1",
        type=IncomeStreamType.PENSION,
        owner_person_id="p1",
        start_month="2026-01",
        monthly_amount_at_start=5000.0
    )
    
    account = InvestmentAccount(
        account_id="a1",
        name="Test Account",
        tax_bucket=TaxBucket.TAX_DEFERRED,
        starting_balance=100000.0,
        annual_return_rate=0.07
    )
    
    scenario = Scenario(
        scenario_id="test_scenario",
        scenario_name="Test Scenario",
        description="Validation test scenario",
        global_settings=GlobalSettings(
            projection_start_month="2026-01",
            projection_end_year=2055,
            residence_state="CA"
        ),
        people=[person],
        income_streams=[stream],
        accounts=[account],
        tax_settings=TaxSettings(
            filing_status=FilingStatus.SINGLE
        )
    )
    
    # Validate references
    scenario.validate_references()
    
    print(f"  ✓ Scenario created: '{scenario.scenario_name}'")
    print(f"  ✓ {len(scenario.people)} person(s), {len(scenario.income_streams)} stream(s), {len(scenario.accounts)} account(s)")
    print(f"  ✓ References validated successfully")


def test_json_serialization():
    """Test JSON serialization/deserialization."""
    print("✓ Testing JSON serialization...")
    
    # Load example scenario
    example_path = Path(__file__).parent / "schemas" / "example_scenario.json"
    
    if example_path.exists():
        with open(example_path) as f:
            data = json.load(f)
        
        # Deserialize
        scenario = Scenario(**data)
        
        # Validate
        scenario.validate_references()
        
        # Serialize back
        json_str = scenario.model_dump_json(indent=2)
        
        print(f"  ✓ Example scenario loaded: '{scenario.scenario_name}'")
        print(f"  ✓ {len(scenario.people)} people, {len(scenario.income_streams)} income streams")
        print(f"  ✓ {len(scenario.accounts)} accounts, {len(scenario.budget.categories)} budget categories")
        print(f"  ✓ JSON round-trip successful")
    else:
        print(f"  ⚠ Example scenario not found at {example_path}")


def main():
    """Run all validation tests."""
    print("=" * 70)
    print("PHASE 1 VALIDATION - Core Foundation & Data Models")
    print("=" * 70)
    print()
    
    try:
        test_person_creation()
        print()
        
        test_income_stream_creation()
        print()
        
        test_investment_account_creation()
        print()
        
        test_budget_creation()
        print()
        
        test_scenario_creation()
        print()
        
        test_json_serialization()
        print()
        
        print("=" * 70)
        print("✅ ALL VALIDATION TESTS PASSED!")
        print("=" * 70)
        print()
        print("Phase 1 is ready. You can now:")
        print("  1. Run unit tests: pytest")
        print("  2. Check coverage: pytest --cov=models --cov-report=html")
        print("  3. Move to Phase 2: Projection Engine")
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
