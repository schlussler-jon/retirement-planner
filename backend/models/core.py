"""
Core data models for retirement planning.

These models represent the fundamental entities: people, income streams, and investment accounts.
"""

from datetime import date
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator, computed_field
from enum import Enum


class TaxBucket(str, Enum):
    """Investment account tax treatment types."""
    TAXABLE = "taxable"
    TAX_DEFERRED = "tax_deferred"
    ROTH = "roth"


class IncomeStreamType(str, Enum):
    """Types of income streams."""
    PENSION = "pension"
    SOCIAL_SECURITY = "social_security"
    SALARY = "salary"
    SELF_EMPLOYMENT = "self_employment"
    OTHER = "other"


class Person(BaseModel):
    """
    Represents an individual in the retirement plan.
    
    Attributes:
        person_id: Unique identifier
        name: Person's name
        birth_date: Date of birth (YYYY-MM-DD)
        life_expectancy_years: Optional expected lifespan from birth
    """
    person_id: str = Field(..., description="Unique identifier for this person")
    name: str = Field(..., min_length=1, description="Person's name")
    birth_date: date = Field(..., description="Date of birth")
    life_expectancy_years: Optional[int] = Field(
        None, 
        ge=0, 
        le=120,
        description="Life expectancy in years from birth (optional)"
    )
    
    @field_validator('birth_date')
    @classmethod
    def validate_birth_date(cls, v: date) -> date:
        """Ensure birth date is not in the future."""
        if v > date.today():
            raise ValueError("Birth date cannot be in the future")
        return v
    
    @computed_field
    @property
    def death_year_month(self) -> Optional[str]:
        """Calculate projected death year-month if life expectancy provided."""
        if self.life_expectancy_years is None:
            return None
        death_year = self.birth_date.year + self.life_expectancy_years
        return f"{death_year}-{self.birth_date.month:02d}"
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "person_id": "person_1",
                    "name": "Jon",
                    "birth_date": "1963-06-09",
                    "life_expectancy_years": 83
                }
            ]
        }
    }


class IncomeStream(BaseModel):
    """
    Represents a recurring income source (pension, Social Security, salary, etc.).
    
    COLA Logic:
    - COLA increases are applied annually in the specified cola_month
    - The increase is: new_amount = current_amount * (1 + cola_percent_annual)
    - COLA can start in any month (1=Jan, 12=Dec)
    
    End Date:
    - Optional end_month allows income to stop (e.g., retirement date, contract end)
    - Format: YYYY-MM (e.g., "2045-12" for December 2045)
    """
    stream_id: str = Field(..., description="Unique identifier for this income stream")
    type: IncomeStreamType = Field(..., description="Type of income stream")
    owner_person_id: str = Field(..., description="ID of person who receives this income")
    start_month: str = Field(
        ..., 
        pattern=r'^\d{4}-\d{2}$',
        description="Start month in YYYY-MM format"
    )
    end_month: Optional[str] = Field(
        None,
        pattern=r'^\d{4}-\d{2}$',
        description="Optional end month in YYYY-MM format (income stops after this month)"
    )
    monthly_amount_at_start: float = Field(
        ..., 
        gt=0,
        description="Monthly payment amount when stream starts"
    )
    cola_percent_annual: float = Field(
        default=0.0,
        ge=0,
        le=0.5,
        description="Annual COLA increase as decimal (e.g., 0.02 = 2%)"
    )
    cola_month: int = Field(
        default=1,
        ge=1,
        le=12,
        description="Month when COLA is applied each year (1=Jan, 12=Dec)"
    )
    
    @field_validator('start_month')
    @classmethod
    def validate_start_month(cls, v: str) -> str:
        """Validate YYYY-MM format."""
        try:
            year, month = v.split('-')
            year_int = int(year)
            month_int = int(month)
            if not (1900 <= year_int <= 2100):
                raise ValueError("Year must be between 1900 and 2100")
            if not (1 <= month_int <= 12):
                raise ValueError("Month must be between 01 and 12")
            return v
        except (ValueError, AttributeError):
            raise ValueError("start_month must be in YYYY-MM format")
    
    @field_validator('end_month')
    @classmethod
    def validate_end_month(cls, v: Optional[str]) -> Optional[str]:
        """Validate YYYY-MM format for end_month if provided."""
        if v is None:
            return None
        try:
            year, month = v.split('-')
            year_int = int(year)
            month_int = int(month)
            if not (1900 <= year_int <= 2100):
                raise ValueError("Year must be between 1900 and 2100")
            if not (1 <= month_int <= 12):
                raise ValueError("Month must be between 01 and 12")
            return v
        except (ValueError, AttributeError):
            raise ValueError("end_month must be in YYYY-MM format")
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "stream_id": "pension_jon",
                    "type": "pension",
                    "owner_person_id": "person_1",
                    "start_month": "2026-01",
                    "end_month": None,
                    "monthly_amount_at_start": 8625.0,
                    "cola_percent_annual": 0.02,
                    "cola_month": 5
                },
                {
                    "stream_id": "ssa_jon",
                    "type": "social_security",
                    "owner_person_id": "person_1",
                    "start_month": "2026-01",
                    "end_month": None,
                    "monthly_amount_at_start": 2597.0,
                    "cola_percent_annual": 0.025,
                    "cola_month": 1
                }
            ]
        }
    }


class InvestmentAccount(BaseModel):
    """
    Represents a retirement or investment account.
    
    Withdrawal Rules (CRITICAL):
    - monthly_withdrawal is a POSITIVE number that REDUCES account balance
    - All withdrawals are considered INCOME (cashflow to the user)
    - Tax treatment:
        * tax_deferred → taxable ordinary income
        * taxable → taxable ordinary income (v1 simplified)
        * roth → non-taxable income
    
    Contribution and Withdrawal Timing:
    - Optional start/end dates control when contributions and withdrawals occur
    - Useful for modeling: contributing while working, withdrawing in retirement
    - Format: YYYY-MM (e.g., "2045-06" for June 2045)
    
    Operation Order Per Month:
    1. Apply contributions (+)
    2. Apply withdrawals (-)
    3. Apply growth (compounded)
    """
    account_id: str = Field(..., description="Unique identifier for this account")
    name: str = Field(..., min_length=1, description="Account display name")
    tax_bucket: TaxBucket = Field(..., description="Tax treatment type")
    starting_balance: float = Field(
        ...,
        ge=0,
        description="Initial account balance"
    )
    annual_return_rate: float = Field(
        ...,
        ge=-0.5,
        le=0.5,
        description="Fixed annual return rate as decimal (e.g., 0.06 = 6%)"
    )
    monthly_contribution: float = Field(
        default=0.0,
        ge=0,
        description="Fixed monthly contribution amount (positive number)"
    )
    contribution_start_month: Optional[str] = Field(
        None,
        pattern=r'^\d{4}-\d{2}$',
        description="Optional start month for contributions in YYYY-MM format"
    )
    contribution_end_month: Optional[str] = Field(
        None,
        pattern=r'^\d{4}-\d{2}$',
        description="Optional end month for contributions in YYYY-MM format"
    )
    monthly_withdrawal: float = Field(
        default=0.0,
        ge=0,
        description="Fixed monthly withdrawal amount (positive number reduces balance)"
    )
    withdrawal_start_month: Optional[str] = Field(
        None,
        pattern=r'^\d{4}-\d{2}$',
        description="Optional start month for withdrawals in YYYY-MM format"
    )
    withdrawal_end_month: Optional[str] = Field(
        None,
        pattern=r'^\d{4}-\d{2}$',
        description="Optional end month for withdrawals in YYYY-MM format"
    )
    
    @field_validator('contribution_start_month', 'contribution_end_month', 
                     'withdrawal_start_month', 'withdrawal_end_month')
    @classmethod
    def validate_month_format(cls, v: Optional[str]) -> Optional[str]:
        """Validate YYYY-MM format for date fields if provided."""
        if v is None:
            return None
        try:
            year, month = v.split('-')
            year_int = int(year)
            month_int = int(month)
            if not (1900 <= year_int <= 2100):
                raise ValueError("Year must be between 1900 and 2100")
            if not (1 <= month_int <= 12):
                raise ValueError("Month must be between 01 and 12")
            return v
        except (ValueError, AttributeError):
            raise ValueError("Month must be in YYYY-MM format")
    
    @computed_field
    @property
    def monthly_return_rate(self) -> float:
        """Calculate the monthly return rate from annual rate."""
        return (1 + self.annual_return_rate) ** (1/12) - 1
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "account_id": "jon_401k",
                    "name": "Jon 401k",
                    "tax_bucket": "tax_deferred",
                    "starting_balance": 65000.0,
                    "annual_return_rate": 0.06,
                    "monthly_contribution": 0.0,
                    "contribution_start_month": None,
                    "contribution_end_month": None,
                    "monthly_withdrawal": 0.0,
                    "withdrawal_start_month": None,
                    "withdrawal_end_month": None
                },
                {
                    "account_id": "jon_457b",
                    "name": "Jon 457b",
                    "tax_bucket": "tax_deferred",
                    "starting_balance": 330000.0,
                    "annual_return_rate": 0.06,
                    "monthly_contribution": 0.0,
                    "contribution_start_month": None,
                    "contribution_end_month": None,
                    "monthly_withdrawal": 1900.0,
                    "withdrawal_start_month": None,
                    "withdrawal_end_month": None
                },
                {
                    "account_id": "savings",
                    "name": "Synchrony High Yield Savings",
                    "tax_bucket": "taxable",
                    "starting_balance": 341085.0,
                    "annual_return_rate": 0.038,
                    "monthly_contribution": 0.0,
                    "contribution_start_month": None,
                    "contribution_end_month": None,
                    "monthly_withdrawal": 0.0,
                    "withdrawal_start_month": None,
                    "withdrawal_end_month": None
                }
            ]
        }
    }


class GlobalSettings(BaseModel):
    """
    Global settings for the retirement projection.
    
    Attributes:
        projection_start_month: When to start the projection (YYYY-MM)
        projection_end_year: Last year to project through (inclusive)
        residence_state: Two-letter state code for tax purposes
    """
    projection_start_month: str = Field(
        ...,
        pattern=r'^\d{4}-\d{2}$',
        description="Projection start month in YYYY-MM format"
    )
    projection_end_year: int = Field(
        ...,
        ge=2000,
        le=2100,
        description="Last year to include in projection"
    )
    residence_state: str = Field(
        ...,
        min_length=2,
        max_length=2,
        description="Two-letter state code (e.g., 'AZ', 'CA')"
    )
    
    @field_validator('projection_start_month')
    @classmethod
    def validate_start_month(cls, v: str) -> str:
        """Validate YYYY-MM format."""
        try:
            year, month = v.split('-')
            year_int = int(year)
            month_int = int(month)
            if not (2000 <= year_int <= 2100):
                raise ValueError("Year must be between 2000 and 2100")
            if not (1 <= month_int <= 12):
                raise ValueError("Month must be between 01 and 12")
            return v
        except (ValueError, AttributeError):
            raise ValueError("projection_start_month must be in YYYY-MM format")
    
    @field_validator('residence_state')
    @classmethod
    def validate_state(cls, v: str) -> str:
        """Ensure state code is uppercase."""
        return v.upper()
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "projection_start_month": "2026-01",
                    "projection_end_year": 2056,
                    "residence_state": "AZ"
                }
            ]
        }
    }
