"""
Main scenario model that combines all inputs.

A Scenario represents a complete retirement planning configuration
with all necessary inputs to run a projection.
"""

from typing import List
from pydantic import BaseModel, Field, field_validator
from .core import GlobalSettings, Person, IncomeStream, InvestmentAccount
from .budget import BudgetSettings, TaxSettings


class Scenario(BaseModel):
    """
    Complete retirement planning scenario.
    
    This is the top-level model that contains all user inputs.
    It can be serialized to/from JSON for storage in Google Drive.
    """
    scenario_id: str = Field(
        ...,
        description="Unique identifier for this scenario"
    )
    scenario_name: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="User-friendly name for this scenario"
    )
    description: str = Field(
        default="",
        max_length=1000,
        description="Optional description/notes"
    )
    
    # Core settings
    global_settings: GlobalSettings = Field(
        ...,
        description="Global projection settings"
    )
    
    # People
    people: List[Person] = Field(
        default_factory=list,
        description="People in this retirement plan"
    )
    
    # Income
    income_streams: List[IncomeStream] = Field(
        default_factory=list,
        description="All income sources (pensions, SSA, etc.)"
    )
    
    # Investments
    accounts: List[InvestmentAccount] = Field(
        default_factory=list,
        description="All investment/retirement accounts"
    )
    
    # Budget
    budget_settings: BudgetSettings = Field(
        default_factory=BudgetSettings,
        description="Budget categories and settings"
    )
    
    # Tax
    tax_settings: TaxSettings = Field(
        ...,
        description="Tax configuration"
    )
    
    @field_validator('people')
    @classmethod
    def validate_people(cls, v: List[Person]) -> List[Person]:
        """Ensure person IDs are unique."""
        if v:
            ids = [p.person_id for p in v]
            if len(ids) != len(set(ids)):
                raise ValueError("Person IDs must be unique")
        return v
    
    @field_validator('income_streams')
    @classmethod
    def validate_income_streams(cls, v: List[IncomeStream]) -> List[IncomeStream]:
        """Ensure stream IDs are unique."""
        if v:
            ids = [s.stream_id for s in v]
            if len(ids) != len(set(ids)):
                raise ValueError("Income stream IDs must be unique")
        return v
    
    @field_validator('accounts')
    @classmethod
    def validate_accounts(cls, v: List[InvestmentAccount]) -> List[InvestmentAccount]:
        """Ensure account IDs are unique."""
        if v:
            ids = [a.account_id for a in v]
            if len(ids) != len(set(ids)):
                raise ValueError("Account IDs must be unique")
        return v
    
    def validate_references(self) -> None:
        """
        Validate that all foreign key references are valid.
        
        Raises ValueError if:
        - Income stream references non-existent person
        """
        person_ids = {p.person_id for p in self.people}
        
        # Check income stream owners
        for stream in self.income_streams:
            if stream.owner_person_id not in person_ids:
                raise ValueError(
                    f"Income stream '{stream.stream_id}' references "
                    f"non-existent person '{stream.owner_person_id}'"
                )
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "scenario_id": "scenario_001",
                    "scenario_name": "Base Retirement Plan",
                    "description": "Conservative planning with current pensions and SSA",
                    "global_settings": {
                        "projection_start_month": "2026-01",
                        "projection_end_year": 2056,
                        "residence_state": "AZ"
                    },
                    "people": [
                        {
                            "person_id": "person_1",
                            "name": "Jon",
                            "birth_date": "1963-06-09",
                            "life_expectancy_years": 83
                        }
                    ],
                    "income_streams": [],
                    "accounts": [],
                    "budget": {
                        "categories": [],
                        "inflation_annual_percent": 0.025
                    },
                    "tax_settings": {
                        "filing_status": "married_filing_jointly",
                        "tax_year_ruleset": 2024
                    }
                }
            ]
        }
    }
