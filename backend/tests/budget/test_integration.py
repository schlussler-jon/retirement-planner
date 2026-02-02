"""
Integration tests for complete retirement planning system.

Tests end-to-end flow from scenario to net income projections.
"""

import pytest
from datetime import date
from models import (
    Scenario,
    Person,
    IncomeStream,
    InvestmentAccount,
    GlobalSettings,
    TaxSettings,
    BudgetSettings,
    BudgetCategory,
    FilingStatus,
    IncomeStreamType,
    TaxBucket,
)
from engine import ProjectionEngine
from tax import calculate_taxes_for_projection
from budget import BudgetProcessor, calculate_net_income_projections


class TestCompleteRetirementPlan:
    """Test complete retirement planning system."""
    
    def test_simple_retirement_scenario(self):
        """Test a simple retirement scenario end-to-end."""
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
            monthly_amount_at_start=5000,
            cola_percent_annual=0.02,
            cola_month=1
        )
        
        ssa = IncomeStream(
            stream_id="ssa",
            type=IncomeStreamType.SOCIAL_SECURITY,
            owner_person_id="p1",
            start_month="2026-01",
            monthly_amount_at_start=2500,
            cola_percent_annual=0.025,
            cola_month=1
        )
        
        account = InvestmentAccount(
            account_id="401k",
            name="401k",
            tax_bucket=TaxBucket.TAX_DEFERRED,
            starting_balance=300000,
            annual_return_rate=0.06,
            monthly_withdrawal=1500
        )
        
        budget = BudgetSettings(
            categories=[
                BudgetCategory(
                    category_name="Housing",
                    category_type="fixed",
                    monthly_amount=2000,
                    include=True
                ),
                BudgetCategory(
                    category_name="Food",
                    category_type="flexible",
                    monthly_amount=800,
                    include=True
                ),
                BudgetCategory(
                    category_name="Entertainment",
                    category_type="flexible",
                    monthly_amount=500,
                    include=True
                ),
            ],
            inflation_annual_percent=0.03,
            survivor_flexible_reduction_percent=0.0,
            survivor_reduction_mode="flex_only"
        )
        
        scenario = Scenario(
            scenario_id="test",
            scenario_name="Test Retirement",
            global_settings=GlobalSettings(
                projection_start_month="2026-01",
                projection_end_year=2028,
                residence_state="AZ"
            ),
            people=[person],
            income_streams=[pension, ssa],
            accounts=[account],
            budget_settings=budget,
            tax_settings=TaxSettings(
                filing_status=FilingStatus.SINGLE
            )
        )
        
        # Phase 2: Run projection
        engine = ProjectionEngine(scenario)
        monthly_projections = engine.run()
        
        assert len(monthly_projections) == 36  # 3 years
        
        # Phase 3: Calculate taxes
        tax_summaries = calculate_taxes_for_projection(
            monthly_projections,
            scenario.income_streams,
            scenario.tax_settings.filing_status,
            scenario.global_settings.residence_state
        )
        
        assert len(tax_summaries) == 3  # 3 years
        
        # Phase 4a: Process budget
        budget_processor = BudgetProcessor(
            scenario.budget_settings,
            scenario.people
        )
        
        spending_amounts = []
        for month_proj in monthly_projections:
            year_month = month_proj.month
            month_num = int(year_month.split('-')[1])
            spending = budget_processor.process_month(year_month, month_num)
            spending_amounts.append(spending)
        
        assert len(spending_amounts) == 36
        
        # Phase 4b: Calculate net income
        net_income_projections = calculate_net_income_projections(
            monthly_projections,
            tax_summaries,
            spending_amounts
        )
        
        assert len(net_income_projections) == 36
        
        # Verify first month
        first = net_income_projections[0]
        assert first.month == "2026-01"
        
        # Income: pension (5000 * 1.02) + ssa (2500 * 1.025) + withdrawal (1500)
        # = 5100 + 2562.5 + 1500 = 9162.5
        assert abs(first.gross_cashflow - 9162.5) < 1
        
        # Spending: 2000 + 800 + 500 = 3300
        assert abs(first.inflation_adjusted_spending - 3300) < 1
        
        # Should have surplus (income > spending + taxes)
        assert first.surplus_deficit > 0
    
    def test_with_survivor_reduction(self):
        """Test scenario with survivor spending reduction."""
        # Couple scenario
        person1 = Person(
            person_id="p1",
            name="Person 1",
            birth_date=date(1960, 1, 1),
            life_expectancy_years=67  # Dies in 2027
        )
        
        person2 = Person(
            person_id="p2",
            name="Person 2",
            birth_date=date(1965, 1, 1),
            life_expectancy_years=90
        )
        
        pension = IncomeStream(
            stream_id="pension",
            type=IncomeStreamType.PENSION,
            owner_person_id="p1",
            start_month="2026-01",
            monthly_amount_at_start=6000
        )
        
        budget = BudgetSettings(
            categories=[
                BudgetCategory(
                    category_name="Housing",
                    category_type="fixed",
                    monthly_amount=3000,
                    include=True
                ),
                BudgetCategory(
                    category_name="Food",
                    category_type="flexible",
                    monthly_amount=1200,
                    include=True
                ),
            ],
            inflation_annual_percent=0.0,
            survivor_flexible_reduction_percent=0.30,  # 30% reduction
            survivor_reduction_mode="flex_only"
        )
        
        scenario = Scenario(
            scenario_id="test",
            scenario_name="Test",
            global_settings=GlobalSettings(
                projection_start_month="2026-01",
                projection_end_year=2028,
                residence_state="FL"
            ),
            people=[person1, person2],
            income_streams=[pension],
            accounts=[],
            budget_settings=budget,
            tax_settings=TaxSettings(
                filing_status=FilingStatus.MARRIED_FILING_JOINTLY
            )
        )
        
        # Run projection
        engine = ProjectionEngine(scenario)
        monthly_projections = engine.run()
        
        # Calculate taxes
        tax_summaries = calculate_taxes_for_projection(
            monthly_projections,
            scenario.income_streams,
            scenario.tax_settings.filing_status,
            scenario.global_settings.residence_state
        )
        
        # Process budget with survivor reduction
        budget_processor = BudgetProcessor(
            scenario.budget_settings,
            scenario.people
        )
        
        spending_amounts = []
        for month_proj in monthly_projections:
            year_month = month_proj.month
            month_num = int(year_month.split('-')[1])
            spending = budget_processor.process_month(year_month, month_num)
            spending_amounts.append(spending)
        
        # Calculate net income
        net_income_projections = calculate_net_income_projections(
            monthly_projections,
            tax_summaries,
            spending_amounts
        )
        
        # Check spending before and after death
        spending_2026_12 = next(
            p.inflation_adjusted_spending
            for p in net_income_projections
            if p.month == "2026-12"
        )
        # Before death: 3000 + 1200 = 4200
        assert abs(spending_2026_12 - 4200) < 1
        
        spending_2027_02 = next(
            p.inflation_adjusted_spending
            for p in net_income_projections
            if p.month == "2027-02"
        )
        # After death: 3000 (fixed, no change) + 840 (1200 * 0.70) = 3840
        assert abs(spending_2027_02 - 3840) < 1
    
    def test_inflation_impact(self):
        """Test impact of inflation on spending."""
        scenario = Scenario(
            scenario_id="test",
            scenario_name="Test",
            global_settings=GlobalSettings(
                projection_start_month="2026-01",
                projection_end_year=2030,
                residence_state="CA"
            ),
            people=[
                Person(
                    person_id="p1",
                    name="Test",
                    birth_date=date(1960, 1, 1)
                )
            ],
            income_streams=[
                IncomeStream(
                    stream_id="pension",
                    type=IncomeStreamType.PENSION,
                    owner_person_id="p1",
                    start_month="2026-01",
                    monthly_amount_at_start=8000,
                    cola_percent_annual=0.03,
                    cola_month=1
                )
            ],
            accounts=[],
            budget_settings=BudgetSettings(
                categories=[
                    BudgetCategory(
                        category_name="Spending",
                        category_type="fixed",
                        monthly_amount=5000,
                        include=True
                    ),
                ],
                inflation_annual_percent=0.04  # 4% inflation
            ),
            tax_settings=TaxSettings(
                filing_status=FilingStatus.SINGLE
            )
        )
        
        # Run projection
        engine = ProjectionEngine(scenario)
        monthly_projections = engine.run()
        
        # Calculate taxes
        tax_summaries = calculate_taxes_for_projection(
            monthly_projections,
            scenario.income_streams,
            scenario.tax_settings.filing_status,
            scenario.global_settings.residence_state
        )
        
        # Process budget
        budget_processor = BudgetProcessor(
            scenario.budget_settings,
            scenario.people
        )
        
        spending_amounts = []
        for month_proj in monthly_projections:
            year_month = month_proj.month
            month_num = int(year_month.split('-')[1])
            spending = budget_processor.process_month(year_month, month_num)
            spending_amounts.append(spending)
        
        # Calculate net income
        net_income_projections = calculate_net_income_projections(
            monthly_projections,
            tax_summaries,
            spending_amounts
        )
        
        # Check spending increases over time
        spending_2026 = next(
            p.inflation_adjusted_spending
            for p in net_income_projections
            if p.month == "2026-02"
        )
        
        spending_2027 = next(
            p.inflation_adjusted_spending
            for p in net_income_projections
            if p.month == "2027-02"
        )
        
        spending_2028 = next(
            p.inflation_adjusted_spending
            for p in net_income_projections
            if p.month == "2028-02"
        )
        
        # Should increase by ~4% each year
        assert spending_2027 > spending_2026
        assert spending_2028 > spending_2027
        
        # Check rough 4% increase
        assert abs((spending_2027 / spending_2026) - 1.04) < 0.01


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
