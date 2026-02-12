"""
Budget and tax-related data models.

These models handle spending categories, inflation, survivor reduction, and tax settings.
"""

from typing import Literal, Optional, List, Dict
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


# Predefined expense categories
EXPENSE_CATEGORIES = [
    "Housing",
    "Utilities & Communications",
    "Food & Household",
    "Transportation",
    "Insurance & Healthcare",
    "Debt Payments",
    "Savings & Investing",
    "Family & Personal",
    "Entertainment & Lifestyle",
    "Giving & Miscellaneous"
]


class BudgetCategory(BaseModel):
    """
    A single budget category (e.g., Housing, Groceries).
    
    Attributes:
        category_name: Display name (or subcategory within main category)
        category_type: Fixed or flexible
        monthly_amount: Base monthly spending amount
        include: Whether to include in budget calculations
        main_category: One of the predefined expense categories
        end_month: Optional month when expense stops (YYYY-MM format)
    """
    category_name: str = Field(..., min_length=1, description="Category name or description")
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
    main_category: str = Field(
        default="Giving & Miscellaneous",
        description="Main expense category"
    )
    end_month: Optional[str] = Field(
        None,
        description="Month when expense stops (YYYY-MM format), e.g., '2035-06' for June 2035"
    )
    
    @field_validator('main_category')
    @classmethod
    def validate_main_category(cls, v: str) -> str:
        """Ensure main_category is one of the predefined categories."""
        if v not in EXPENSE_CATEGORIES:
            raise ValueError(f"main_category must be one of: {', '.join(EXPENSE_CATEGORIES)}")
        return v
    
    @field_validator('end_month')
    @classmethod
    def validate_end_month(cls, v: Optional[str]) -> Optional[str]:
        """Validate end_month format if provided."""
        if v is not None:
            # Basic format check: YYYY-MM
            parts = v.split('-')
            if len(parts) != 2:
                raise ValueError("end_month must be in YYYY-MM format")
            try:
                year = int(parts[0])
                month = int(parts[1])
                if not (1 <= month <= 12):
                    raise ValueError("Month must be between 1 and 12")
                if not (2020 <= year <= 2100):
                    raise ValueError("Year must be between 2020 and 2100")
            except ValueError as e:
                raise ValueError(f"Invalid end_month format: {e}")
        return v
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "category_name": "Mortgage Payment",
                    "category_type": "fixed",
                    "monthly_amount": 2500.0,
                    "include": True,
                    "main_category": "Housing",
                    "end_month": "2045-12"
                },
                {
                    "category_name": "Travel Budget",
                    "category_type": "flexible",
                    "monthly_amount": 300.0,
                    "include": True,
                    "main_category": "Entertainment & Lifestyle",
                    "end_month": None
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
                            "category_name": "Mortgage",
                            "category_type": "fixed",
                            "monthly_amount": 1500.0,
                            "include": True,
                            "main_category": "Housing",
                            "end_month": "2045-06"
                        },
                        {
                            "category_name": "Groceries",
                            "category_type": "fixed",
                            "monthly_amount": 800.0,
                            "include": True,
                            "main_category": "Food & Household",
                            "end_month": None
                        },
                        {
                            "category_name": "Travel",
                            "category_type": "flexible",
                            "monthly_amount": 400.0,
                            "include": True,
                            "main_category": "Entertainment & Lifestyle",
                            "end_month": None
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
    
    Supports both flat rates and progressive brackets.
    Progressive brackets are used when available, otherwise falls back to flat rates.
    """
    
    # States with no income tax
    NO_TAX_STATES = {
        'AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY'
    }
    
    # Progressive tax brackets for states (2025 data)
    # Format: 'STATE': { 'filing_status': [(threshold, rate), ...] }
    PROGRESSIVE_BRACKETS = {
        'CA': {
            'single': [
                (10099, 0.01),
                (23942, 0.02),
                (37788, 0.04),
                (52455, 0.06),
                (66295, 0.08),
                (338639, 0.093),
                (406364, 0.103),
                (677275, 0.113),
                (1000000, 0.123),
                (float('inf'), 0.133)  # 13.3% on income over $1M
            ],
            'married_filing_jointly': [
                (20198, 0.01),
                (47884, 0.02),
                (75576, 0.04),
                (104910, 0.06),
                (132590, 0.08),
                (677278, 0.093),
                (812728, 0.103),
                (1000000, 0.113),
                (1354550, 0.123),
                (float('inf'), 0.133)  # 13.3% on income over $1.35M
            ],
            'head_of_household': [
                (20212, 0.01),
                (47887, 0.02),
                (61730, 0.04),
                (76343, 0.06),
                (96920, 0.08),
                (494503, 0.093),
                (592005, 0.103),
                (1000000, 0.113),
                (1016644, 0.123),
                (float('inf'), 0.133)
            ],
            'married_filing_separately': [
                (10099, 0.01),
                (23942, 0.02),
                (37788, 0.04),
                (52455, 0.06),
                (66295, 0.08),
                (338639, 0.093),
                (406364, 0.103),
                (500000, 0.113),
                (677275, 0.123),
                (float('inf'), 0.133)
            ],
        },
        # Add more states here as needed
        # 'NY': { ... },
        # 'OR': { ... },
    }
    
    # Simplified flat rates for states without progressive brackets
    FLAT_RATES = {
        'AZ': 0.025,  # Arizona approximate effective rate
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
    def has_progressive_brackets(cls, state_code: str) -> bool:
        """Check if a state has progressive tax brackets defined."""
        return state_code.upper() in cls.PROGRESSIVE_BRACKETS
    
    @classmethod
    def get_progressive_brackets(cls, state_code: str, filing_status: str) -> List[tuple]:
        """
        Get progressive tax brackets for a state and filing status.
        
        Args:
            state_code: Two-letter state code
            filing_status: Filing status (single, married_filing_jointly, etc.)
            
        Returns:
            List of (threshold, rate) tuples, or None if not available
        """
        state_code = state_code.upper()
        if state_code not in cls.PROGRESSIVE_BRACKETS:
            return None
        
        state_brackets = cls.PROGRESSIVE_BRACKETS[state_code]
        
        # Map filing status to bracket key (fallback to single if not found)
        return state_brackets.get(filing_status, state_brackets.get('single'))
    
    @classmethod
    def get_state_rate(cls, state_code: str) -> float:
        """
        Get flat state tax rate (fallback for states without progressive brackets).
        
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
