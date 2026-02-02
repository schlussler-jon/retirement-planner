#!/usr/bin/env python3
"""
Phase 3 Validation Script

This script validates that the tax calculation module is working correctly.
Run this after installing dependencies to verify your setup.
"""

import sys
from pathlib import Path
from datetime import date

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from models import FilingStatus, Scenario, Person, IncomeStream, InvestmentAccount
from models import GlobalSettings, TaxSettings, IncomeStreamType, TaxBucket
from tax import (
    calculate_taxable_ssa,
    calculate_federal_tax,
    calculate_state_tax,
    TaxCalculator,
    calculate_taxes_for_projection,
)
from engine import ProjectionEngine


def test_ssa_taxation():
    """Test Social Security taxation."""
    print("✓ Testing Social Security Taxation...")
    
    # Test Tier 1: 0% taxable (below threshold)
    taxable_tier1 = calculate_taxable_ssa(
        ssa_income=20000,
        other_ordinary_income=5000,
        filing_status=FilingStatus.SINGLE
    )
    assert taxable_tier1 == 0.0
    print(f"  ✓ Tier 1 (0%): SSA=$20k, Other=$5k → Taxable=$0")
    
    # Test Tier 2: 50% range
    taxable_tier2 = calculate_taxable_ssa(
        ssa_income=20000,
        other_ordinary_income=20000,
        filing_status=FilingStatus.SINGLE
    )
    assert 0 < taxable_tier2 <= 10000  # Max 50% of SSA
    print(f"  ✓ Tier 2 (50%): SSA=$20k, Other=$20k → Taxable=${taxable_tier2:,.0f}")
    
    # Test Tier 3: 85% range
    taxable_tier3 = calculate_taxable_ssa(
        ssa_income=40000,
        other_ordinary_income=50000,
        filing_status=FilingStatus.SINGLE
    )
    assert taxable_tier2 < taxable_tier3 <= 34000  # Max 85% of SSA
    print(f"  ✓ Tier 3 (85%): SSA=$40k, Other=$50k → Taxable=${taxable_tier3:,.0f}")


def test_federal_tax():
    """Test federal income tax."""
    print("✓ Testing Federal Income Tax...")
    
    # Test progressive brackets
    tax_low = calculate_federal_tax(
        taxable_income=30000,
        filing_status=FilingStatus.SINGLE
    )
    print(f"  ✓ Single, $30k taxable → ${tax_low:,.0f} tax")
    
    tax_high = calculate_federal_tax(
        taxable_income=100000,
        filing_status=FilingStatus.SINGLE
    )
    print(f"  ✓ Single, $100k taxable → ${tax_high:,.0f} tax")
    
    # Higher income should have higher tax
    assert tax_high > tax_low
    
    # Test MFJ has lower tax at same income
    tax_mfj = calculate_federal_tax(
        taxable_income=100000,
        filing_status=FilingStatus.MARRIED_FILING_JOINTLY
    )
    assert tax_mfj < tax_high
    print(f"  ✓ MFJ, $100k taxable → ${tax_mfj:,.0f} tax (lower than single)")


def test_state_tax():
    """Test state income tax."""
    print("✓ Testing State Income Tax...")
    
    # No-tax state
    tax_fl = calculate_state_tax(100000, "FL")
    assert tax_fl == 0.0
    print(f"  ✓ Florida (no tax): AGI=$100k → $0 tax")
    
    # Arizona (2.5%)
    tax_az = calculate_state_tax(100000, "AZ")
    assert tax_az == 2500
    print(f"  ✓ Arizona (2.5%): AGI=$100k → ${tax_az:,.0f} tax")
    
    # California (9.3%)
    tax_ca = calculate_state_tax(100000, "CA")
    assert tax_ca == 9300
    print(f"  ✓ California (9.3%): AGI=$100k → ${tax_ca:,.0f} tax")


def test_tax_calculator():
    """Test integrated tax calculator."""
    print("✓ Testing Tax Calculator...")
    
    calculator = TaxCalculator(
        filing_status=FilingStatus.MARRIED_FILING_JOINTLY,
        residence_state="AZ"
    )
    
    tax_summary = calculator.calculate_annual_taxes(
        annual_ssa_income=55000,
        annual_other_income=145000
    )
    
    print(f"  ✓ Annual taxes calculated:")
    print(f"    SSA Income: ${tax_summary.total_ssa_income:,.0f}")
    print(f"    Taxable SSA: ${tax_summary.taxable_ssa_income:,.0f}")
    print(f"    AGI: ${tax_summary.agi:,.0f}")
    print(f"    Federal Tax: ${tax_summary.federal_tax:,.0f}")
    print(f"    State Tax: ${tax_summary.state_tax:,.0f}")
    print(f"    Total Tax: ${tax_summary.total_tax:,.0f}")
    print(f"    Effective Rate: {tax_summary.effective_tax_rate*100:.1f}%")
    
    # Sanity checks
    assert tax_summary.agi > 0
    assert tax_summary.federal_tax > 0
    assert tax_summary.state_tax > 0
    assert 0.10 < tax_summary.effective_tax_rate < 0.30


def test_projection_integration():
    """Test tax integration with projection engine."""
    print("✓ Testing Projection Integration...")
    
    # Create scenario
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
        monthly_amount_at_start=5000
    )
    
    ssa = IncomeStream(
        stream_id="ssa",
        type=IncomeStreamType.SOCIAL_SECURITY,
        owner_person_id="p1",
        start_month="2026-01",
        monthly_amount_at_start=2500
    )
    
    account = InvestmentAccount(
        account_id="401k",
        name="401k",
        tax_bucket=TaxBucket.TAX_DEFERRED,
        starting_balance=300000,
        annual_return_rate=0.06,
        monthly_withdrawal=1500
    )
    
    scenario = Scenario(
        scenario_id="test",
        scenario_name="Test Scenario",
        global_settings=GlobalSettings(
            projection_start_month="2026-01",
            projection_end_year=2028,
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
    
    print(f"  ✓ Projection: {len(monthly)} months generated")
    
    # Calculate taxes
    tax_summaries = calculate_taxes_for_projection(
        monthly,
        scenario.income_streams,
        scenario.tax_settings.filing_status,
        scenario.global_settings.residence_state
    )
    
    print(f"  ✓ Tax summaries: {len(tax_summaries)} years calculated")
    
    for tax_summary in tax_summaries:
        print(f"    Year {tax_summary.year}:")
        print(f"      Total Tax: ${tax_summary.total_tax:,.0f}")
        print(f"      Effective Rate: {tax_summary.effective_tax_rate*100:.1f}%")


def main():
    """Run all validation tests."""
    print("=" * 70)
    print("PHASE 3 VALIDATION - Tax Calculation Module")
    print("=" * 70)
    print()
    
    try:
        test_ssa_taxation()
        print()
        
        test_federal_tax()
        print()
        
        test_state_tax()
        print()
        
        test_tax_calculator()
        print()
        
        test_projection_integration()
        print()
        
        print("=" * 70)
        print("✅ ALL VALIDATION TESTS PASSED!")
        print("=" * 70)
        print()
        print("Phase 3 is ready. You can now:")
        print("  1. Run unit tests: pytest tests/tax/ -v")
        print("  2. Check coverage: pytest tests/tax/ --cov=tax --cov-report=html")
        print("  3. Move to Phase 4: Net Income & Budget")
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
