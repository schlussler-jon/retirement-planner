"""
Unit tests for core data models.

Tests Person, IncomeStream, InvestmentAccount, and GlobalSettings.
"""

import pytest
from datetime import date
from pydantic import ValidationError
from models.core import (
    Person,
    IncomeStream,
    InvestmentAccount,
    GlobalSettings,
    TaxBucket,
    IncomeStreamType,
)


class TestPerson:
    """Tests for Person model."""
    
    def test_valid_person(self):
        """Test creating a valid person."""
        person = Person(
            person_id="p1",
            name="Jon",
            birth_date=date(1963, 6, 9),
            life_expectancy_years=83
        )
        assert person.person_id == "p1"
        assert person.name == "Jon"
        assert person.death_year_month == "2046-06"
    
    def test_person_without_life_expectancy(self):
        """Test person without life expectancy."""
        person = Person(
            person_id="p1",
            name="Jon",
            birth_date=date(1963, 6, 9)
        )
        assert person.life_expectancy_years is None
        assert person.death_year_month is None
    
    def test_future_birth_date_invalid(self):
        """Test that future birth dates are rejected."""
        from datetime import timedelta
        future_date = date.today() + timedelta(days=365)
        
        with pytest.raises(ValidationError) as exc_info:
            Person(
                person_id="p1",
                name="Future Baby",
                birth_date=future_date
            )
        assert "Birth date cannot be in the future" in str(exc_info.value)
    
    def test_invalid_life_expectancy(self):
        """Test invalid life expectancy values."""
        with pytest.raises(ValidationError):
            Person(
                person_id="p1",
                name="Jon",
                birth_date=date(1963, 6, 9),
                life_expectancy_years=-5
            )
        
        with pytest.raises(ValidationError):
            Person(
                person_id="p1",
                name="Jon",
                birth_date=date(1963, 6, 9),
                life_expectancy_years=150
            )
    
    def test_empty_name_invalid(self):
        """Test that empty name is rejected."""
        with pytest.raises(ValidationError):
            Person(
                person_id="p1",
                name="",
                birth_date=date(1963, 6, 9)
            )


class TestIncomeStream:
    """Tests for IncomeStream model."""
    
    def test_valid_pension(self):
        """Test creating a valid pension stream."""
        stream = IncomeStream(
            stream_id="pension_1",
            type=IncomeStreamType.PENSION,
            owner_person_id="p1",
            start_month="2026-01",
            monthly_amount_at_start=8625.0,
            cola_percent_annual=0.02,
            cola_month=5
        )
        assert stream.stream_id == "pension_1"
        assert stream.type == IncomeStreamType.PENSION
        assert stream.cola_month == 5
    
    def test_valid_social_security(self):
        """Test creating a valid SSA stream."""
        stream = IncomeStream(
            stream_id="ssa_1",
            type=IncomeStreamType.SOCIAL_SECURITY,
            owner_person_id="p1",
            start_month="2026-06",
            monthly_amount_at_start=2597.0,
            cola_percent_annual=0.025,
            cola_month=1
        )
        assert stream.type == IncomeStreamType.SOCIAL_SECURITY
        assert stream.cola_percent_annual == 0.025
    
    def test_default_cola_values(self):
        """Test default COLA values."""
        stream = IncomeStream(
            stream_id="other_1",
            type=IncomeStreamType.OTHER,
            owner_person_id="p1",
            start_month="2026-01",
            monthly_amount_at_start=1000.0
        )
        assert stream.cola_percent_annual == 0.0
        assert stream.cola_month == 1
    
    def test_invalid_start_month_format(self):
        """Test invalid start month formats."""
        with pytest.raises(ValidationError):
            IncomeStream(
                stream_id="s1",
                type=IncomeStreamType.PENSION,
                owner_person_id="p1",
                start_month="2026/01",  # Wrong separator
                monthly_amount_at_start=1000.0
            )
        
        with pytest.raises(ValidationError):
            IncomeStream(
                stream_id="s1",
                type=IncomeStreamType.PENSION,
                owner_person_id="p1",
                start_month="2026-13",  # Invalid month
                monthly_amount_at_start=1000.0
            )
    
    def test_invalid_cola_month(self):
        """Test invalid COLA month values."""
        with pytest.raises(ValidationError):
            IncomeStream(
                stream_id="s1",
                type=IncomeStreamType.PENSION,
                owner_person_id="p1",
                start_month="2026-01",
                monthly_amount_at_start=1000.0,
                cola_month=0  # Must be 1-12
            )
    
    def test_negative_amount_invalid(self):
        """Test that negative amounts are rejected."""
        with pytest.raises(ValidationError):
            IncomeStream(
                stream_id="s1",
                type=IncomeStreamType.PENSION,
                owner_person_id="p1",
                start_month="2026-01",
                monthly_amount_at_start=-100.0
            )


class TestInvestmentAccount:
    """Tests for InvestmentAccount model."""
    
    def test_valid_tax_deferred_account(self):
        """Test creating a valid tax-deferred account."""
        account = InvestmentAccount(
            account_id="401k_1",
            name="Jon 401k",
            tax_bucket=TaxBucket.TAX_DEFERRED,
            starting_balance=65000.0,
            annual_return_rate=0.06,
            monthly_contribution=500.0,
            monthly_withdrawal=0.0
        )
        assert account.account_id == "401k_1"
        assert account.tax_bucket == TaxBucket.TAX_DEFERRED
        assert account.monthly_contribution == 500.0
    
    def test_monthly_return_rate_calculation(self):
        """Test monthly return rate computation."""
        account = InvestmentAccount(
            account_id="acct_1",
            name="Test Account",
            tax_bucket=TaxBucket.ROTH,
            starting_balance=10000.0,
            annual_return_rate=0.12  # 12% annual
        )
        # Monthly rate: (1.12)^(1/12) - 1 ≈ 0.00949
        monthly_rate = account.monthly_return_rate
        assert 0.0094 < monthly_rate < 0.0096
    
    def test_roth_account(self):
        """Test Roth account creation."""
        account = InvestmentAccount(
            account_id="roth_1",
            name="Roth IRA",
            tax_bucket=TaxBucket.ROTH,
            starting_balance=50000.0,
            annual_return_rate=0.08
        )
        assert account.tax_bucket == TaxBucket.ROTH
    
    def test_taxable_account(self):
        """Test taxable account creation."""
        account = InvestmentAccount(
            account_id="brokerage_1",
            name="Fidelity Brokerage",
            tax_bucket=TaxBucket.TAXABLE,
            starting_balance=220000.0,
            annual_return_rate=0.09,
            monthly_withdrawal=1000.0
        )
        assert account.tax_bucket == TaxBucket.TAXABLE
        assert account.monthly_withdrawal == 1000.0
    
    def test_negative_balance_invalid(self):
        """Test that negative starting balance is rejected."""
        with pytest.raises(ValidationError):
            InvestmentAccount(
                account_id="acct_1",
                name="Test",
                tax_bucket=TaxBucket.TAXABLE,
                starting_balance=-1000.0,
                annual_return_rate=0.06
            )
    
    def test_negative_contribution_invalid(self):
        """Test that negative contributions are rejected."""
        with pytest.raises(ValidationError):
            InvestmentAccount(
                account_id="acct_1",
                name="Test",
                tax_bucket=TaxBucket.TAXABLE,
                starting_balance=1000.0,
                annual_return_rate=0.06,
                monthly_contribution=-100.0
            )
    
    def test_negative_withdrawal_invalid(self):
        """Test that negative withdrawals are rejected."""
        with pytest.raises(ValidationError):
            InvestmentAccount(
                account_id="acct_1",
                name="Test",
                tax_bucket=TaxBucket.TAXABLE,
                starting_balance=1000.0,
                annual_return_rate=0.06,
                monthly_withdrawal=-100.0
            )


class TestGlobalSettings:
    """Tests for GlobalSettings model."""
    
    def test_valid_settings(self):
        """Test creating valid global settings."""
        settings = GlobalSettings(
            projection_start_month="2026-01",
            projection_end_year=2056,
            residence_state="AZ"
        )
        assert settings.projection_start_month == "2026-01"
        assert settings.projection_end_year == 2056
        assert settings.residence_state == "AZ"
    
    def test_state_code_uppercase_conversion(self):
        """Test that state codes are converted to uppercase."""
        settings = GlobalSettings(
            projection_start_month="2026-01",
            projection_end_year=2056,
            residence_state="ca"
        )
        assert settings.residence_state == "CA"
    
    def test_invalid_start_month_format(self):
        """Test invalid start month formats."""
        with pytest.raises(ValidationError):
            GlobalSettings(
                projection_start_month="2026-1",  # Missing leading zero
                projection_end_year=2056,
                residence_state="AZ"
            )
    
    def test_invalid_year_range(self):
        """Test invalid year values."""
        with pytest.raises(ValidationError):
            GlobalSettings(
                projection_start_month="2026-01",
                projection_end_year=1999,  # Too early
                residence_state="AZ"
            )
        
        with pytest.raises(ValidationError):
            GlobalSettings(
                projection_start_month="2026-01",
                projection_end_year=2101,  # Too late
                residence_state="AZ"
            )
    
    def test_invalid_state_code_length(self):
        """Test invalid state code lengths."""
        with pytest.raises(ValidationError):
            GlobalSettings(
                projection_start_month="2026-01",
                projection_end_year=2056,
                residence_state="A"  # Too short
            )
        
        with pytest.raises(ValidationError):
            GlobalSettings(
                projection_start_month="2026-01",
                projection_end_year=2056,
                residence_state="ABC"  # Too long
            )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
