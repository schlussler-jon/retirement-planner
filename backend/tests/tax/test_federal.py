"""
Unit tests for federal income tax calculations.

Tests progressive brackets, AGI, and taxable income calculations.
"""

import pytest
from models import FilingStatus
from tax.federal import (
    calculate_agi,
    calculate_taxable_income,
    calculate_federal_tax,
    calculate_effective_tax_rate,
    get_standard_deduction,
    get_tax_bracket_breakdown,
    STANDARD_DEDUCTION_2024,
)


class TestStandardDeduction:
    """Tests for standard deduction."""
    
    def test_single_deduction(self):
        """Test single filer standard deduction."""
        deduction = get_standard_deduction(FilingStatus.SINGLE)
        assert deduction == 14600  # 2024 amount
    
    def test_mfj_deduction(self):
        """Test married filing jointly deduction."""
        deduction = get_standard_deduction(FilingStatus.MARRIED_FILING_JOINTLY)
        assert deduction == 29200  # 2024 amount
    
    def test_deduction_override(self):
        """Test standard deduction override."""
        deduction = get_standard_deduction(
            FilingStatus.SINGLE,
            override=20000
        )
        assert deduction == 20000


class TestAGI:
    """Tests for Adjusted Gross Income calculation."""
    
    def test_basic_agi(self):
        """Test basic AGI with ordinary income and taxable SSA."""
        agi = calculate_agi(
            ordinary_income=50000,
            taxable_ssa_income=10000
        )
        
        assert agi == 60000
    
    def test_agi_with_adjustments(self):
        """Test AGI with above-the-line adjustments."""
        agi = calculate_agi(
            ordinary_income=50000,
            taxable_ssa_income=10000,
            adjustments=5000
        )
        
        # 50000 + 10000 - 5000 = 55000
        assert agi == 55000
    
    def test_agi_with_capital_gains(self):
        """Test AGI with capital gains."""
        agi = calculate_agi(
            ordinary_income=40000,
            taxable_ssa_income=8000,
            capital_gains=12000
        )
        
        # 40000 + 8000 + 12000 = 60000
        assert agi == 60000


class TestTaxableIncome:
    """Tests for taxable income calculation."""
    
    def test_basic_taxable_income(self):
        """Test taxable income with standard deduction."""
        taxable = calculate_taxable_income(
            agi=50000,
            filing_status=FilingStatus.SINGLE
        )
        
        # 50000 - 14600 (standard deduction) = 35400
        assert taxable == 35400
    
    def test_taxable_income_cannot_be_negative(self):
        """Test that taxable income is never negative."""
        taxable = calculate_taxable_income(
            agi=10000,
            filing_status=FilingStatus.SINGLE
        )
        
        # AGI < standard deduction, should be 0
        assert taxable == 0.0
    
    def test_taxable_income_with_override(self):
        """Test taxable income with custom deduction."""
        taxable = calculate_taxable_income(
            agi=60000,
            filing_status=FilingStatus.SINGLE,
            standard_deduction_override=20000
        )
        
        # 60000 - 20000 = 40000
        assert taxable == 40000


class TestFederalTaxSingle:
    """Tests for federal tax calculation - single filer."""
    
    def test_first_bracket_only(self):
        """Test income entirely in first (10%) bracket."""
        # 2024 Single: First $11,600 at 10%
        tax = calculate_federal_tax(
            taxable_income=10000,
            filing_status=FilingStatus.SINGLE
        )
        
        # 10000 * 0.10 = 1000
        assert tax == 1000
    
    def test_two_brackets(self):
        """Test income spanning two brackets."""
        # Single 2024:
        # $0-11,600 at 10%
        # $11,600-47,150 at 12%
        
        tax = calculate_federal_tax(
            taxable_income=30000,
            filing_status=FilingStatus.SINGLE
        )
        
        # First bracket: 11600 * 0.10 = 1160
        # Second bracket: (30000 - 11600) * 0.12 = 2208
        # Total: 3368
        expected = 1160 + 2208
        assert abs(tax - expected) < 1.0
    
    def test_multiple_brackets(self):
        """Test income spanning multiple brackets."""
        # Test with $150,000 taxable income
        tax = calculate_federal_tax(
            taxable_income=150000,
            filing_status=FilingStatus.SINGLE
        )
        
        # Should be positive and reasonable
        assert tax > 0
        # Rough check: should be between 15% and 35% effective
        effective_rate = tax / 150000
        assert 0.15 < effective_rate < 0.35
    
    def test_zero_taxable_income(self):
        """Test with zero taxable income."""
        tax = calculate_federal_tax(
            taxable_income=0,
            filing_status=FilingStatus.SINGLE
        )
        
        assert tax == 0.0


class TestFederalTaxMFJ:
    """Tests for married filing jointly."""
    
    def test_mfj_first_bracket(self):
        """Test MFJ first bracket."""
        # MFJ 2024: First $23,200 at 10%
        tax = calculate_federal_tax(
            taxable_income=20000,
            filing_status=FilingStatus.MARRIED_FILING_JOINTLY
        )
        
        # 20000 * 0.10 = 2000
        assert tax == 2000
    
    def test_mfj_multiple_brackets(self):
        """Test MFJ with multiple brackets."""
        tax = calculate_federal_tax(
            taxable_income=150000,
            filing_status=FilingStatus.MARRIED_FILING_JOINTLY
        )
        
        # Should be less than single filer at same income
        tax_single = calculate_federal_tax(
            taxable_income=150000,
            filing_status=FilingStatus.SINGLE
        )
        
        assert tax < tax_single


class TestEffectiveTaxRate:
    """Tests for effective tax rate calculation."""
    
    def test_effective_rate(self):
        """Test effective tax rate calculation."""
        rate = calculate_effective_tax_rate(
            total_tax=15000,
            agi=100000
        )
        
        # 15000 / 100000 = 0.15 (15%)
        assert rate == 0.15
    
    def test_zero_agi(self):
        """Test effective rate with zero AGI."""
        rate = calculate_effective_tax_rate(
            total_tax=0,
            agi=0
        )
        
        assert rate == 0.0


class TestTaxBracketBreakdown:
    """Tests for detailed bracket breakdown."""
    
    def test_breakdown_single_bracket(self):
        """Test breakdown with income in single bracket."""
        breakdown = get_tax_bracket_breakdown(
            taxable_income=10000,
            filing_status=FilingStatus.SINGLE
        )
        
        # Should only have one bracket
        assert len(breakdown) == 1
        assert breakdown[0]["rate"] == 0.10
        assert breakdown[0]["amount_in_bracket"] == 10000
        assert breakdown[0]["tax_in_bracket"] == 1000
    
    def test_breakdown_multiple_brackets(self):
        """Test breakdown spanning multiple brackets."""
        breakdown = get_tax_bracket_breakdown(
            taxable_income=50000,
            filing_status=FilingStatus.SINGLE
        )
        
        # Should span at least 3 brackets
        assert len(breakdown) >= 3
        
        # Total tax from all brackets should match full calculation
        total_from_breakdown = sum(b["tax_in_bracket"] for b in breakdown)
        total_calculated = calculate_federal_tax(
            taxable_income=50000,
            filing_status=FilingStatus.SINGLE
        )
        
        assert abs(total_from_breakdown - total_calculated) < 0.01
    
    def test_breakdown_zero_income(self):
        """Test breakdown with zero income."""
        breakdown = get_tax_bracket_breakdown(
            taxable_income=0,
            filing_status=FilingStatus.SINGLE
        )
        
        assert len(breakdown) == 0


class TestEndToEndCalculation:
    """Test complete tax calculation flow."""
    
    def test_complete_single_filer(self):
        """Test complete calculation for single filer."""
        # Ordinary income: $80,000
        # Taxable SSA: $15,000
        # Filing: Single
        
        agi = calculate_agi(
            ordinary_income=80000,
            taxable_ssa_income=15000
        )
        assert agi == 95000
        
        taxable_income = calculate_taxable_income(
            agi=agi,
            filing_status=FilingStatus.SINGLE
        )
        # 95000 - 14600 = 80400
        assert taxable_income == 80400
        
        tax = calculate_federal_tax(
            taxable_income=taxable_income,
            filing_status=FilingStatus.SINGLE
        )
        
        # Should be reasonable (roughly 12-15% effective)
        effective_rate = calculate_effective_tax_rate(tax, agi)
        assert 0.10 < effective_rate < 0.20
    
    def test_complete_mfj(self):
        """Test complete calculation for married filing jointly."""
        # Higher income couple
        agi = calculate_agi(
            ordinary_income=150000,
            taxable_ssa_income=40000
        )
        assert agi == 190000
        
        taxable_income = calculate_taxable_income(
            agi=agi,
            filing_status=FilingStatus.MARRIED_FILING_JOINTLY
        )
        # 190000 - 29200 = 160800
        assert taxable_income == 160800
        
        tax = calculate_federal_tax(
            taxable_income=taxable_income,
            filing_status=FilingStatus.MARRIED_FILING_JOINTLY
        )
        
        # Should be positive
        assert tax > 0
        
        # Effective rate should be reasonable
        effective_rate = calculate_effective_tax_rate(tax, agi)
        assert 0.10 < effective_rate < 0.25


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
