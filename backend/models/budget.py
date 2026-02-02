"""
Budget and tax-related data models.

These models handle spending categories, inflation, survivor reduction, and tax settings.
"""

from typing import Literal, Optional, List
from pydantic import BaseModel, Field, field_validator
from enum import Enum


class CategoryType(str, Enum):
    """Budget category types."""
    FIXED = "fixed"
    FLEXIBLE = "flexible"


class SurvivorReductionMode(str, Enum):
    """How to apply survivor spending reduction."""
    FLEX_ONLY = "flex_only"  # Reduce only flexible spending
    ALL = "all"  # Reduce all spending


class FilingStatus(str, Enum):
    """Federal tax filing status."""
    SINGLE = "single"
    MARRIED_FILING_JOINTLY = "married_filing_jointly"
    MARRIED_FILING_SEPARATELY = "married_filing_separately"
    HEAD_OF_HOUSEHOLD = "head_of_household"


class BudgetCategory(BaseModel):
    """
    A single budget category (e.g., Housing, Groceries).
    
    Attributes:
        category_name: Display name
        category_type: Fixed or flexible
        monthly_amount: Base monthly spending amount
        include: Whether to include in budget calculations
    """
    category_name: str = Field(..., min_length=1, description="Category name")
    category_type: CategoryType = Field(..., description="Fixed or flexible spending")
    monthly_amount: float = Field(
        ...,
        ge=0,
        description="Monthly spending amount"
    )
    include: bool = Field(
        default=True,
        description="Whether to include this category in calculations"
    )
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "category_name": "Housing (Mortgage/Rent)",
                    "category_type": "fixed",
                    "monthly_amount": 1500.0,
                    "include": True
                },
                {
                    "category_name": "Travel",
                    "category_type": "flexible",
                    "monthly_amount": 300.0,
                    "include": True
                }
            ]
        }
    }


class BudgetSettings(BaseModel):
    """
    Budget configuration and inflation settings.
    
    Inflation is applied annually to all spending amounts.
    Survivor reduction is applied when one person in a couple passes away.
    """
    categories: List[BudgetCategory] = Field(
        default_factory=list,
        description="List of budget categories"
    )
    inflation_annual_percent: float = Field(
        default=0.025,
        ge=0,
        le=0.2,
        description="Annual inflation rate as decimal (e.g., 0.025 = 2.5%)"
    )
    survivor_flexible_reduction_percent: float = Field(
        default=0.0,
        ge=0,
        le=1.0,
        description="Percent to reduce spending when survivor (e.g., 0.25 = 25% reduction)"
    )
    survivor_reduction_mode: SurvivorReductionMode = Field(
        default=SurvivorReductionMode.FLEX_ONLY,
        description="Apply reduction to flexible only or all categories"
    )
    
    @field_validator('categories')
    @classmethod
    def validate_categories(cls, v: List[BudgetCategory]) -> List[BudgetCategory]:
        """Ensure category names are unique."""
        if v:
            names = [cat.category_name for cat in v]
            if len(names) != len(set(names)):
                raise ValueError("Budget category names must be unique")
        return v
    
    def total_monthly_spending(self) -> float:
        """Calculate total monthly spending from included categories."""
        return sum(cat.monthly_amount for cat in self.categories if cat.include)
    
    def total_fixed_spending(self) -> float:
        """Calculate total fixed monthly spending."""
        return sum(
            cat.monthly_amount 
            for cat in self.categories 
            if cat.include and cat.category_type == CategoryType.FIXED
        )
    
    def total_flexible_spending(self) -> float:
        """Calculate total flexible monthly spending."""
        return sum(
            cat.monthly_amount 
            for cat in self.categories 
            if cat.include and cat.category_type == CategoryType.FLEXIBLE
        )
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "categories": [
                        {
                            "category_name": "Housing",
                            "category_type": "fixed",
                            "monthly_amount": 1500.0,
                            "include": True
                        },
                        {
                            "category_name": "Groceries",
                            "category_type": "fixed",
                            "monthly_amount": 800.0,
                            "include": True
                        },
                        {
                            "category_name": "Travel",
                            "category_type": "flexible",
                            "monthly_amount": 400.0,
                            "include": True
                        }
                    ],
                    "inflation_annual_percent": 0.025,
                    "survivor_flexible_reduction_percent": 0.25,
                    "survivor_reduction_mode": "flex_only"
                }
            ]
        }
    }


class TaxSettings(BaseModel):
    """
    Federal and state tax configuration.
    
    Attributes:
        filing_status: Federal filing status
        standard_deduction_override: Optional override for standard deduction
        tax_year_ruleset: Which year's tax brackets to use (e.g., 2024)
    """
    filing_status: FilingStatus = Field(
        ...,
        description="Federal tax filing status"
    )
    standard_deduction_override: Optional[float] = Field(
        None,
        ge=0,
        description="Override standard deduction amount (optional)"
    )
    tax_year_ruleset: int = Field(
        default=2024,
        ge=2020,
        le=2030,
        description="Tax year for bracket rules"
    )
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "filing_status": "married_filing_jointly",
                    "standard_deduction_override": None,
                    "tax_year_ruleset": 2024
                },
                {
                    "filing_status": "single",
                    "standard_deduction_override": 15000.0,
                    "tax_year_ruleset": 2024
                }
            ]
        }
    }


# State tax configuration data
class StateTaxConfig:
    """
    State tax configuration lookup.
    
    This class provides state-specific tax information.
    In v1, we use simplified flat rates or no-tax designations.
    """
    
    # States with no income tax
    NO_TAX_STATES = {
        'AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY'
    }
    
    # Simplified flat rates for v1 (approximate)
    # In v2, these would be full progressive brackets
    FLAT_RATES = {
        'AZ': 0.025,  # Arizona approximate effective rate
        'CA': 0.093,  # California approximate top rate
        'CO': 0.044,  # Colorado flat tax
        'IL': 0.0495, # Illinois flat tax
        'IN': 0.0323, # Indiana flat tax
        'MA': 0.05,   # Massachusetts flat tax
        'MI': 0.0425, # Michigan flat tax
        'NC': 0.0475, # North Carolina flat tax
        'PA': 0.0307, # Pennsylvania flat tax
        'UT': 0.0485, # Utah flat tax
    }
    
    @classmethod
    def get_state_rate(cls, state_code: str) -> float:
        """
        Get state tax rate for a given state.
        
        Returns:
            0.0 for no-tax states
            flat_rate for states with known rates
            0.05 (5%) as fallback for unsupported states
        """
        state_code = state_code.upper()
        
        if state_code in cls.NO_TAX_STATES:
            return 0.0
        
        return cls.FLAT_RATES.get(state_code, 0.05)  # 5% fallback
    
    @classmethod
    def is_no_tax_state(cls, state_code: str) -> bool:
        """Check if state has no income tax."""
        return state_code.upper() in cls.NO_TAX_STATES
