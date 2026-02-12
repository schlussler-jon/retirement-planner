"""
Core domain models for retirement planning.

These models represent the fundamental entities in a retirement scenario:
people, income streams, and investment accounts.
"""

from pydantic import BaseModel, Field, field_validator, computed_field
from typing import Optional
from datetime import date
from enum import Enum


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
                    "life_expectancy_years": 85
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
                    "stream_id": "pension_1",
                    "type": "pension",
                    "owner_person_id": "person_1",
                    "start_month": "2035-01",
                    "end_month": None,
                    "monthly_amount_at_start": 5000.0,
                    "cola_percent_annual": 0.02,
                    "cola_month": 1
                }
            ]
        }
    }


class TaxBucket(str, Enum):
    """Tax treatment categories for investment accounts."""
    TAXABLE = "taxable"
    TAX_DEFERRED = "tax_deferred"
    ROTH = "roth"


class InvestmentAccount(BaseModel):
    """
    Represents an investment account (401k, IRA, Roth, brokerage, etc.).
    
    Tax Treatment:
    - taxable: Contributions are after-tax, gains/withdrawals taxed
    - tax_deferred: Contributions pre-tax, withdrawals fully taxed (401k, traditional IRA)
    - roth: Contributions after-tax, withdrawals tax-free
    """
    account_id: str = Field(..., description="Unique identifier for this account")
    name: str = Field(..., min_length=1, description="Account name")
    tax_bucket: TaxBucket = Field(..., description="Tax treatment category")
    starting_balance: float = Field(
        ..., 
        ge=0,
        description="Account balance at projection start"
    )
    annual_return_rate: float = Field(
        ...,
        ge=-0.5,
        le=0.5,
        description="Expected annual return as decimal (e.g., 0.06 = 6%)"
    )
    monthly_contribution: float = Field(
        default=0.0,
        ge=0,
        description="Monthly contribution amount"
    )
    monthly_withdrawal: float = Field(
        default=0.0,
        ge=0,
        description="Monthly withdrawal amount"
    )
    
    @computed_field
    @property
    def monthly_return_rate(self) -> float:
        """Convert annual return to monthly compounding rate."""
        return (1 + self.annual_return_rate) ** (1/12) - 1
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "account_id": "401k_1",
                    "name": "Primary 401k",
                    "tax_bucket": "tax_deferred",
                    "starting_balance": 500000.0,
                    "annual_return_rate": 0.06,
                    "monthly_contribution": 0.0,
                    "monthly_withdrawal": 2000.0
                }
            ]
        }
    }
