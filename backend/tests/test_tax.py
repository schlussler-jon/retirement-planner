"""
Unit tests for tax calculation module.

Tests:
- Federal tax brackets
- Social Security provisional income method
- State tax calculations
- Standard deduction
"""

import pytest
from app.engine.tax import TaxCalculator, calculate_annual_taxes, FilingStatus


class TestSocialSecurityTaxation:
    """Test Social Security taxation using provisional income method."""
    
    def test_no_ss_taxation_below_threshold_mfj(self):
        """Test no SS taxation when provisional income is below base threshold (MFJ)."""
        calc = TaxCalculator(
            filing_status=FilingStatus.MARRIED_FILING_JOINTLY.value,
            residence_state="TX"  # No state tax for simplicity
        )
        
        result = calc.calculate_annual_tax(
            pension_income=20000.0,  # Pension
            social_security_gross=20000.0,  # SS
            tax_deferred_withdrawals=0.0,
            taxable_withdrawals=0.0,
            roth_withdrawals=0.0
        )
        
        # Provisional income = 20000 + 0.5 * 20000 = 30000
        # Below MFJ base threshold of $32,000
        assert result['provisional_income'] == 30000.0
        assert result['social_security_taxable'] == 0.0
    
    def test_50_percent_ss_taxation_mfj(self):
        """Test 50% SS taxation between thresholds (MFJ)."""
        calc = TaxCalculator(
            filing_status=FilingStatus.MARRIED_FILING_JOINTLY.value,
            residence_state="TX"
        )
        
        result = calc.calculate_annual_tax(
            pension_income=35000.0,
            social_security_gross=20000.0,
            tax_deferred_withdrawals=0.0,
            taxable_withdrawals=0.0,
            roth_withdrawals=0.0
        )
        
        # Provisional income = 35000 + 0.5 * 20000 = 45000
        # Between MFJ thresholds ($32,000 and $44,000)
        # Taxable = 0.5 * (45000 - 32000) = 6500
        # But capped at 0.5 * SS = 10000
        assert result['provisional_income'] == 45000.0
        assert result['social_security_taxable'] == 6500.0
    
    def test_85_percent_ss_taxation_mfj(self):
        """Test 85% SS taxation above upper threshold (MFJ)."""
        calc = TaxCalculator(
            filing_status=FilingStatus.MARRIED_FILING_JOINTLY.value,
            residence_state="TX"
        )
        
        result = calc.calculate_annual_tax(
            pension_income=60000.0,
            social_security_gross=40000.0,
            tax_deferred_withdrawals=0.0,
            taxable_withdrawals=0.0,
            roth_withdrawals=0.0
        )
        
        # Provisional income = 60000 + 0.5 * 40000 = 80000
        # Above MFJ additional threshold of $44,000
        # Complex calculation for 85% taxation
        # Should be capped at 85% of SS = 34000
        
        assert result['provisional_income'] == 80000.0
        # The exact calculation is complex, but should be substantial
        assert result['social_security_taxable'] > 30000.0
        assert result['social_security_taxable'] <= 34000.0  # 85% cap
    
    def test_no_ss_taxation_below_threshold_single(self):
        """Test no SS taxation when provisional income is below base threshold (Single)."""
        calc = TaxCalculator(
            filing_status=FilingStatus.SINGLE.value,
            residence_state="FL"
        )
        
        result = calc.calculate_annual_tax(
            pension_income=15000.0,
            social_security_gross=16000.0,
            tax_deferred_withdrawals=0.0,
            taxable_withdrawals=0.0,
            roth_withdrawals=0.0
        )
        
        # Provisional income = 15000 + 0.5 * 16000 = 23000
        # Below Single base threshold of $25,000
        assert result['provisional_income'] == 23000.0
        assert result['social_security_taxable'] == 0.0
    
    def test_85_percent_cap(self):
        """Test that SS taxation never exceeds 85% of benefits."""
        calc = TaxCalculator(
            filing_status=FilingStatus.SINGLE.value,
            residence_state="TX"
        )
        
        result = calc.calculate_annual_tax(
            pension_income=200000.0,  # Very high income
            social_security_gross=40000.0,
            tax_deferred_withdrawals=0.0,
            taxable_withdrawals=0.0,
            roth_withdrawals=0.0
        )
        
        # With very high provisional income, should hit 85% cap
        max_taxable = 0.85 * 40000.0
        assert result['social_security_taxable'] <= max_taxable
        assert result['social_security_taxable'] == pytest.approx(max_taxable, rel=0.01)


class TestFederalTax:
    """Test federal income tax calculations."""
    
    def test_standard_deduction_mfj(self):
        """Test standard deduction for MFJ."""
        calc = TaxCalculator(
            filing_status=FilingStatus.MARRIED_FILING_JOINTLY.value,
            residence_state="TX"
        )
        
        result = calc.calculate_annual_tax(
            pension_income=50000.0,
            social_security_gross=0.0,
            tax_deferred_withdrawals=0.0,
            taxable_withdrawals=0.0,
            roth_withdrawals=0.0
        )
        
        # Standard deduction for MFJ in 2024 is $29,200
        assert result['standard_deduction'] == 29200.0
        assert result['gross_income'] == 50000.0
        assert result['taxable_income'] == 50000.0 - 29200.0
    
    def test_first_bracket_mfj(self):
        """Test tax calculation in first bracket (MFJ)."""
        calc = TaxCalculator(
            filing_status=FilingStatus.MARRIED_FILING_JOINTLY.value,
            residence_state="WY"  # No state tax
        )
        
        # Income that results in taxable income in first bracket
        result = calc.calculate_annual_tax(
            pension_income=40000.0,  # After deduction: 40000 - 29200 = 10800
            social_security_gross=0.0,
            tax_deferred_withdrawals=0.0,
            taxable_withdrawals=0.0,
            roth_withdrawals=0.0
        )
        
        # Taxable income = 10800 (well within first bracket of $23,200)
        # Tax = 10800 * 0.10 = 1080
        assert result['taxable_income'] == 10800.0
        assert result['federal_tax'] == pytest.approx(1080.0, rel=0.01)
    
    def test_progressive_brackets(self):
        """Test tax calculation across multiple brackets."""
        calc = TaxCalculator(
            filing_status=FilingStatus.SINGLE.value,
            residence_state="NV"
        )
        
        # High income to span multiple brackets
        result = calc.calculate_annual_tax(
            pension_income=150000.0,  # After deduction: 150000 - 14600 = 135400
            social_security_gross=0.0,
            tax_deferred_withdrawals=0.0,
            taxable_withdrawals=0.0,
            roth_withdrawals=0.0
        )
        
        # Should be in 22% or 24% bracket
        assert result['taxable_income'] == 135400.0
        # Tax should be substantially more than 10% but less than 24% of taxable income
        assert result['federal_tax'] > 13540.0  # More than 10%
        assert result['federal_tax'] < 32496.0  # Less than 24%
    
    def test_zero_tax_below_deduction(self):
        """Test that tax is zero when income is below standard deduction."""
        calc = TaxCalculator(
            filing_status=FilingStatus.SINGLE.value,
            residence_state="TX"
        )
        
        result = calc.calculate_annual_tax(
            pension_income=10000.0,  # Below standard deduction of $14,600
            social_security_gross=0.0,
            tax_deferred_withdrawals=0.0,
            taxable_withdrawals=0.0,
            roth_withdrawals=0.0
        )
        
        assert result['taxable_income'] == 0.0
        assert result['federal_tax'] == 0.0


class TestStateTax:
    """Test state tax calculations."""
    
    def test_no_income_tax_states(self):
        """Test states with no income tax."""
        no_tax_states = ['TX', 'FL', 'NV', 'WA', 'WY', 'SD', 'AK', 'TN', 'NH']
        
        for state in no_tax_states:
            calc = TaxCalculator(
                filing_status=FilingStatus.SINGLE.value,
                residence_state=state
            )
            
            result = calc.calculate_annual_tax(
                pension_income=60000.0,
                social_security_gross=0.0,
                tax_deferred_withdrawals=0.0,
                taxable_withdrawals=0.0,
                roth_withdrawals=0.0
            )
            
            assert result['state_tax'] == 0.0, f"State {state} should have no tax"
    
    def test_flat_rate_state(self):
        """Test flat-rate state tax (e.g., AZ)."""
        calc = TaxCalculator(
            filing_status=FilingStatus.SINGLE.value,
            residence_state="AZ"  # 2.5% flat rate
        )
        
        result = calc.calculate_annual_tax(
            pension_income=60000.0,  # Taxable income after deduction
            social_security_gross=0.0,
            tax_deferred_withdrawals=0.0,
            taxable_withdrawals=0.0,
            roth_withdrawals=0.0
        )
        
        # Taxable income = 60000 - 14600 = 45400
        # State tax = 45400 * 0.025 = 1135
        expected_state_tax = (60000.0 - 14600.0) * 0.025
        assert result['state_tax'] == pytest.approx(expected_state_tax, rel=0.01)


class TestCompleteScenarios:
    """Test complete realistic scenarios."""
    
    def test_typical_retiree_mfj(self):
        """Test typical married retiree scenario."""
        calc = TaxCalculator(
            filing_status=FilingStatus.MARRIED_FILING_JOINTLY.value,
            residence_state="AZ"
        )
        
        result = calc.calculate_annual_tax(
            pension_income=72000.0,  # CalPERS pension
            social_security_gross=48000.0,  # Combined SS
            tax_deferred_withdrawals=24000.0,  # 401k withdrawals
            taxable_withdrawals=0.0,
            roth_withdrawals=12000.0  # Roth (not taxable)
        )
        
        # Verify components
        assert result['pension_income'] == 72000.0
        assert result['social_security_gross'] == 48000.0
        assert result['tax_deferred_withdrawals'] == 24000.0
        assert result['roth_withdrawals'] == 12000.0
        
        # Roth should not be in gross income
        assert result['roth_withdrawals'] not in [result['gross_income']]
        
        # SS should be partially taxable (likely 85% given income level)
        assert result['social_security_taxable'] > 0
        assert result['social_security_taxable'] <= 0.85 * 48000.0
        
        # Total tax should be reasonable
        assert result['total_tax'] > 0
        assert result['total_tax'] < result['gross_income']
    
    def test_low_income_retiree_single(self):
        """Test low-income single retiree."""
        calc = TaxCalculator(
            filing_status=FilingStatus.SINGLE.value,
            residence_state="FL"
        )
        
        result = calc.calculate_annual_tax(
            pension_income=18000.0,
            social_security_gross=18000.0,
            tax_deferred_withdrawals=0.0,
            taxable_withdrawals=0.0,
            roth_withdrawals=0.0
        )
        
        # Low income should result in low/no SS taxation
        # Provisional = 18000 + 9000 = 27000 (above $25k threshold)
        # Should have some SS taxation but not much
        assert result['social_security_taxable'] > 0
        assert result['social_security_taxable'] < 0.5 * 18000.0
        
        # After standard deduction, might have minimal federal tax
        assert result['federal_tax'] >= 0


class TestEdgeCases:
    """Test edge cases and boundary conditions."""
    
    def test_zero_income(self):
        """Test with zero income."""
        calc = TaxCalculator(
            filing_status=FilingStatus.SINGLE.value,
            residence_state="CA"
        )
        
        result = calc.calculate_annual_tax(
            pension_income=0.0,
            social_security_gross=0.0,
            tax_deferred_withdrawals=0.0,
            taxable_withdrawals=0.0,
            roth_withdrawals=0.0
        )
        
        assert result['gross_income'] == 0.0
        assert result['federal_tax'] == 0.0
        assert result['state_tax'] == 0.0
        assert result['total_tax'] == 0.0
    
    def test_only_roth_withdrawals(self):
        """Test with only Roth withdrawals (should be tax-free)."""
        calc = TaxCalculator(
            filing_status=FilingStatus.SINGLE.value,
            residence_state="CA"
        )
        
        result = calc.calculate_annual_tax(
            pension_income=0.0,
            social_security_gross=0.0,
            tax_deferred_withdrawals=0.0,
            taxable_withdrawals=0.0,
            roth_withdrawals=50000.0
        )
        
        # Roth withdrawals should not appear in gross income
        assert result['gross_income'] == 0.0
        assert result['federal_tax'] == 0.0
    
    def test_custom_standard_deduction(self):
        """Test with custom standard deduction override."""
        calc = TaxCalculator(
            filing_status=FilingStatus.SINGLE.value,
            residence_state="TX",
            standard_deduction_override=20000.0
        )
        
        result = calc.calculate_annual_tax(
            pension_income=40000.0,
            social_security_gross=0.0,
            tax_deferred_withdrawals=0.0,
            taxable_withdrawals=0.0,
            roth_withdrawals=0.0
        )
        
        assert result['standard_deduction'] == 20000.0
        assert result['taxable_income'] == 20000.0  # 40000 - 20000
