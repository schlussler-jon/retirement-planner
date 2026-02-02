"""
Unit tests for Social Security taxation.

Tests the provisional income method and all three tax tiers.
"""

import pytest
from models import FilingStatus
from tax.social_security import (
    calculate_provisional_income,
    calculate_taxable_ssa,
    get_ssa_taxation_summary,
    calculate_non_taxable_ssa,
)


class TestProvisionalIncome:
    """Tests for provisional income calculation."""
    
    def test_basic_calculation(self):
        """Test basic provisional income formula."""
        # Formula: Other Income + Tax-Exempt Interest + 50% of SSA
        provisional = calculate_provisional_income(
            ssa_income=20000,
            other_ordinary_income=30000,
            tax_exempt_interest=0
        )
        
        # 30000 + 0 + (0.5 * 20000) = 40000
        assert provisional == 40000
    
    def test_with_tax_exempt_interest(self):
        """Test provisional income with tax-exempt interest."""
        provisional = calculate_provisional_income(
            ssa_income=24000,
            other_ordinary_income=20000,
            tax_exempt_interest=5000
        )
        
        # 20000 + 5000 + (0.5 * 24000) = 37000
        assert provisional == 37000


class TestSingleFilerSSA:
    """Tests for single filer Social Security taxation."""
    
    def test_tier1_zero_percent(self):
        """Test Tier 1: Below base threshold - 0% taxable."""
        # Single base threshold: $25,000
        # SSA: $20,000, Other: $5,000
        # Provisional: 5000 + (0.5 * 20000) = 15000 < 25000
        
        taxable = calculate_taxable_ssa(
            ssa_income=20000,
            other_ordinary_income=5000,
            filing_status=FilingStatus.SINGLE
        )
        
        assert taxable == 0.0
    
    def test_tier1_at_threshold(self):
        """Test right at base threshold."""
        # Provisional exactly at 25000 should be 0% taxable
        taxable = calculate_taxable_ssa(
            ssa_income=20000,
            other_ordinary_income=15000,  # 15000 + 10000 = 25000
            filing_status=FilingStatus.SINGLE
        )
        
        assert taxable == 0.0
    
    def test_tier2_fifty_percent(self):
        """Test Tier 2: Between base and max - up to 50% taxable."""
        # Single: base=25000, max=34000
        # SSA: 20000, Other: 20000
        # Provisional: 20000 + (0.5 * 20000) = 30000
        # Between 25000 and 34000, so 50% tier applies
        # Taxable: 0.5 * (30000 - 25000) = 2500
        
        taxable = calculate_taxable_ssa(
            ssa_income=20000,
            other_ordinary_income=20000,
            filing_status=FilingStatus.SINGLE
        )
        
        assert abs(taxable - 2500) < 0.01
    
    def test_tier2_capped_at_50_percent(self):
        """Test that 50% tier is capped at 50% of SSA."""
        # Even if calculation would exceed 50% of SSA, it's capped
        taxable = calculate_taxable_ssa(
            ssa_income=10000,
            other_ordinary_income=25000,  # High other income
            filing_status=FilingStatus.SINGLE
        )
        
        # Cap at 50% of SSA
        assert taxable <= 5000  # 50% of 10000
    
    def test_tier3_eighty_five_percent(self):
        """Test Tier 3: Above max threshold - up to 85% taxable."""
        # Single: max=34000
        # SSA: 40000, Other: 40000
        # Provisional: 40000 + (0.5 * 40000) = 60000 > 34000
        # 85% tier applies
        
        taxable = calculate_taxable_ssa(
            ssa_income=40000,
            other_ordinary_income=40000,
            filing_status=FilingStatus.SINGLE
        )
        
        # Should be 85% tier calculation
        # 50% portion: 0.5 * (34000 - 25000) = 4500
        # 85% portion: 0.85 * (60000 - 34000) = 22100
        # Total: 26600
        expected = 4500 + 22100
        assert abs(taxable - expected) < 1.0
    
    def test_tier3_capped_at_85_percent(self):
        """Test that total is capped at 85% of SSA."""
        # With very high income, ensure cap applies
        taxable = calculate_taxable_ssa(
            ssa_income=30000,
            other_ordinary_income=100000,
            filing_status=FilingStatus.SINGLE
        )
        
        # Cap at 85% of SSA
        max_taxable = 0.85 * 30000
        assert taxable <= max_taxable
        assert abs(taxable - max_taxable) < 0.01  # Should hit cap


class TestMarriedFilingJointlySSA:
    """Tests for married filing jointly SSA taxation."""
    
    def test_tier1_zero_percent(self):
        """Test MFJ Tier 1: Below $32,000."""
        # MFJ base threshold: $32,000
        taxable = calculate_taxable_ssa(
            ssa_income=30000,
            other_ordinary_income=10000,
            filing_status=FilingStatus.MARRIED_FILING_JOINTLY
        )
        
        # Provisional: 10000 + (0.5 * 30000) = 25000 < 32000
        assert taxable == 0.0
    
    def test_tier2_fifty_percent(self):
        """Test MFJ Tier 2: Between $32,000 and $44,000."""
        # MFJ: base=32000, max=44000
        # SSA: 40000, Other: 20000
        # Provisional: 20000 + (0.5 * 40000) = 40000
        
        taxable = calculate_taxable_ssa(
            ssa_income=40000,
            other_ordinary_income=20000,
            filing_status=FilingStatus.MARRIED_FILING_JOINTLY
        )
        
        # 0.5 * (40000 - 32000) = 4000
        assert abs(taxable - 4000) < 0.01
    
    def test_tier3_eighty_five_percent(self):
        """Test MFJ Tier 3: Above $44,000."""
        taxable = calculate_taxable_ssa(
            ssa_income=55164,  # From example scenario
            other_ordinary_income=144156,
            filing_status=FilingStatus.MARRIED_FILING_JOINTLY
        )
        
        # Provisional: 144156 + (0.5 * 55164) = 171738
        # Way above 44000, so 85% tier
        # Should be close to 85% of SSA
        max_taxable = 0.85 * 55164  # 46889.4
        
        # Should be at or near the cap
        assert abs(taxable - max_taxable) < 1.0


class TestEdgeCases:
    """Test edge cases and special scenarios."""
    
    def test_zero_ssa_income(self):
        """Test with zero SSA income."""
        taxable = calculate_taxable_ssa(
            ssa_income=0,
            other_ordinary_income=50000,
            filing_status=FilingStatus.SINGLE
        )
        
        assert taxable == 0.0
    
    def test_negative_ssa_income(self):
        """Test with negative SSA (should not happen, but handle gracefully)."""
        taxable = calculate_taxable_ssa(
            ssa_income=-1000,
            other_ordinary_income=30000,
            filing_status=FilingStatus.SINGLE
        )
        
        assert taxable == 0.0
    
    def test_zero_other_income(self):
        """Test with only SSA income, no other income."""
        # With no other income, provisional = 0.5 * SSA
        # For Single, need provisional > 25000
        # So need SSA > 50000
        
        taxable = calculate_taxable_ssa(
            ssa_income=60000,
            other_ordinary_income=0,
            filing_status=FilingStatus.SINGLE
        )
        
        # Provisional: 0 + (0.5 * 60000) = 30000
        # Between 25000 and 34000, so 50% tier
        # 0.5 * (30000 - 25000) = 2500
        assert abs(taxable - 2500) < 0.01


class TestSSATaxationSummary:
    """Test the detailed summary function."""
    
    def test_summary_tier1(self):
        """Test summary for Tier 1 (0% taxable)."""
        summary = get_ssa_taxation_summary(
            ssa_income=20000,
            other_ordinary_income=5000,
            filing_status=FilingStatus.SINGLE
        )
        
        assert summary["ssa_income"] == 20000
        assert summary["provisional_income"] == 15000
        assert summary["taxable_ssa"] == 0.0
        assert summary["taxable_percentage"] == 0.0
        assert summary["tier"] == 1
    
    def test_summary_tier2(self):
        """Test summary for Tier 2 (50% range)."""
        summary = get_ssa_taxation_summary(
            ssa_income=20000,
            other_ordinary_income=20000,
            filing_status=FilingStatus.SINGLE
        )
        
        assert summary["tier"] == 2
        assert 0 < summary["taxable_percentage"] <= 50
    
    def test_summary_tier3(self):
        """Test summary for Tier 3 (85% range)."""
        summary = get_ssa_taxation_summary(
            ssa_income=40000,
            other_ordinary_income=50000,
            filing_status=FilingStatus.SINGLE
        )
        
        assert summary["tier"] == 3
        assert 50 < summary["taxable_percentage"] <= 85


class TestNonTaxableSSA:
    """Test calculation of non-taxable SSA portion."""
    
    def test_non_taxable_portion(self):
        """Test that non-taxable + taxable = total."""
        ssa_income = 30000
        other_income = 25000
        filing_status = FilingStatus.SINGLE
        
        taxable = calculate_taxable_ssa(
            ssa_income, other_income, filing_status
        )
        
        non_taxable = calculate_non_taxable_ssa(
            ssa_income, other_income, filing_status
        )
        
        # Should sum to total SSA income
        assert abs((taxable + non_taxable) - ssa_income) < 0.01


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
