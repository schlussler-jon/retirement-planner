"""
Unit tests for net income projections.

Tests net income calculations and surplus/deficit tracking.
"""

import pytest
from models import (
    MonthlyProjection,
    TaxSummary,
    NetIncomeProjection,
    FilingStatus,
)
from budget.net_income import (
    NetIncomeCalculator,
    calculate_net_income_projections,
    get_financial_summary,
    get_annual_summaries,
    identify_deficit_periods,
)


class TestNetIncomeCalculator:
    """Tests for NetIncomeCalculator class."""
    
    def test_monthly_tax_estimates(self):
        """Test creation of monthly tax estimates."""
        tax_summaries = [
            TaxSummary(
                year=2026,
                total_ssa_income=30000,
                taxable_ssa_income=15000,
                other_ordinary_income=50000,
                agi=65000,
                standard_deduction=14600,
                taxable_income=50400,
                federal_tax=6000,
                state_tax=1200,
                total_tax=7200,
                effective_tax_rate=0.1108,
                filing_status="single"
            )
        ]
        
        calculator = NetIncomeCalculator(tax_summaries)
        
        # Check January
        federal, state, total = calculator.get_monthly_tax_estimate("2026-01")
        assert federal == 500  # 6000 / 12
        assert state == 100  # 1200 / 12
        assert total == 600  # 7200 / 12
        
        # Check December (should be same)
        federal, state, total = calculator.get_monthly_tax_estimate("2026-12")
        assert federal == 500
        assert state == 100
        assert total == 600
    
    def test_net_income_calculation(self):
        """Test net income calculation."""
        calculator = NetIncomeCalculator([])
        
        net_income = calculator.calculate_net_income(
            gross_cashflow=8000,
            estimated_monthly_tax=1500
        )
        
        assert net_income == 6500  # 8000 - 1500
    
    def test_surplus_calculation(self):
        """Test surplus calculation."""
        calculator = NetIncomeCalculator([])
        
        # Surplus case
        surplus = calculator.calculate_surplus_deficit(
            net_income=7000,
            spending=5000
        )
        assert surplus == 2000  # Positive surplus
        
        # Deficit case
        deficit = calculator.calculate_surplus_deficit(
            net_income=5000,
            spending=7000
        )
        assert deficit == -2000  # Negative deficit
    
    def test_create_projection(self):
        """Test creating a complete net income projection."""
        tax_summaries = [
            TaxSummary(
                year=2026,
                total_ssa_income=30000,
                taxable_ssa_income=15000,
                other_ordinary_income=60000,
                agi=75000,
                standard_deduction=14600,
                taxable_income=60400,
                federal_tax=8400,
                state_tax=1875,
                total_tax=10275,
                effective_tax_rate=0.137,
                filing_status="single"
            )
        ]
        
        calculator = NetIncomeCalculator(tax_summaries)
        
        monthly_proj = MonthlyProjection(
            month="2026-01",
            income_by_stream={"pension": 5000, "ssa": 2500},
            withdrawals_by_account={"401k": 1000},
            withdrawals_by_tax_bucket={"tax_deferred": 1000},
            balances_by_account={"401k": 250000},
            balances_by_tax_bucket={"tax_deferred": 250000},
            total_investments=250000,
            total_gross_cashflow=8500,  # 5000 + 2500 + 1000
            filing_status="single"
        )
        
        net_proj = calculator.create_projection(
            monthly_proj,
            monthly_spending=6000
        )
        
        # Check calculations
        assert net_proj.month == "2026-01"
        assert net_proj.gross_cashflow == 8500
        assert abs(net_proj.estimated_total_tax - 856.25) < 0.01  # 10275 / 12
        assert abs(net_proj.net_income_after_tax - 7643.75) < 0.01  # 8500 - 856.25
        assert net_proj.inflation_adjusted_spending == 6000
        assert abs(net_proj.surplus_deficit - 1643.75) < 0.01  # 7643.75 - 6000


class TestNetIncomeProjections:
    """Tests for complete net income projections."""
    
    def test_calculate_projections(self):
        """Test calculating projections for multiple months."""
        monthly_projections = [
            MonthlyProjection(
                month="2026-01",
                income_by_stream={},
                withdrawals_by_account={},
                withdrawals_by_tax_bucket={},
                balances_by_account={},
                balances_by_tax_bucket={},
                total_investments=100000,
                total_gross_cashflow=7000,
                filing_status="single"
            ),
            MonthlyProjection(
                month="2026-02",
                income_by_stream={},
                withdrawals_by_account={},
                withdrawals_by_tax_bucket={},
                balances_by_account={},
                balances_by_tax_bucket={},
                total_investments=100000,
                total_gross_cashflow=7000,
                filing_status="single"
            ),
        ]
        
        tax_summaries = [
            TaxSummary(
                year=2026,
                total_ssa_income=24000,
                taxable_ssa_income=12000,
                other_ordinary_income=60000,
                agi=72000,
                standard_deduction=14600,
                taxable_income=57400,
                federal_tax=7200,
                state_tax=1800,
                total_tax=9000,
                effective_tax_rate=0.125,
                filing_status="single"
            )
        ]
        
        spending_amounts = [5000, 5000]
        
        net_projections = calculate_net_income_projections(
            monthly_projections,
            tax_summaries,
            spending_amounts
        )
        
        assert len(net_projections) == 2
        
        # Check first month
        assert net_projections[0].month == "2026-01"
        assert net_projections[0].gross_cashflow == 7000
        assert abs(net_projections[0].estimated_total_tax - 750) < 1  # 9000 / 12
        assert abs(net_projections[0].net_income_after_tax - 6250) < 1  # 7000 - 750
        assert abs(net_projections[0].surplus_deficit - 1250) < 1  # 6250 - 5000


class TestFinancialSummary:
    """Tests for financial summary generation."""
    
    def test_get_financial_summary(self):
        """Test generating financial summary."""
        net_projections = [
            NetIncomeProjection(
                month="2026-01",
                gross_cashflow=8000,
                estimated_federal_tax=600,
                estimated_state_tax=150,
                estimated_total_tax=750,
                net_income_after_tax=7250,
                inflation_adjusted_spending=6000,
                surplus_deficit=1250
            ),
            NetIncomeProjection(
                month="2026-02",
                gross_cashflow=8000,
                estimated_federal_tax=600,
                estimated_state_tax=150,
                estimated_total_tax=750,
                net_income_after_tax=7250,
                inflation_adjusted_spending=6000,
                surplus_deficit=1250
            ),
            NetIncomeProjection(
                month="2026-03",
                gross_cashflow=7500,
                estimated_federal_tax=600,
                estimated_state_tax=150,
                estimated_total_tax=750,
                net_income_after_tax=6750,
                inflation_adjusted_spending=7000,
                surplus_deficit=-250  # Deficit!
            ),
        ]
        
        summary = get_financial_summary(net_projections)
        
        assert summary["total_gross_income"] == 23500  # 8000 + 8000 + 7500
        assert summary["total_taxes"] == 2250  # 750 * 3
        assert summary["total_spending"] == 19000  # 6000 + 6000 + 7000
        assert summary["total_surplus_deficit"] == 2250  # 1250 + 1250 - 250
        assert summary["months_in_surplus"] == 2
        assert summary["months_in_deficit"] == 1
        assert summary["total_months"] == 3
    
    def test_get_annual_summaries(self):
        """Test grouping projections by year."""
        net_projections = [
            NetIncomeProjection(
                month="2026-01",
                gross_cashflow=8000,
                estimated_federal_tax=600,
                estimated_state_tax=150,
                estimated_total_tax=750,
                net_income_after_tax=7250,
                inflation_adjusted_spending=6000,
                surplus_deficit=1250
            ),
            NetIncomeProjection(
                month="2026-02",
                gross_cashflow=8000,
                estimated_federal_tax=600,
                estimated_state_tax=150,
                estimated_total_tax=750,
                net_income_after_tax=7250,
                inflation_adjusted_spending=6000,
                surplus_deficit=1250
            ),
            NetIncomeProjection(
                month="2027-01",
                gross_cashflow=8500,
                estimated_federal_tax=650,
                estimated_state_tax=160,
                estimated_total_tax=810,
                net_income_after_tax=7690,
                inflation_adjusted_spending=6200,
                surplus_deficit=1490
            ),
        ]
        
        annual = get_annual_summaries(net_projections)
        
        assert len(annual) == 2
        
        # 2026
        assert annual[0]["year"] == 2026
        assert annual[0]["total_gross_income"] == 16000
        assert annual[0]["total_taxes"] == 1500
        assert annual[0]["total_spending"] == 12000
        assert annual[0]["total_surplus_deficit"] == 2500
        
        # 2027
        assert annual[1]["year"] == 2027
        assert annual[1]["total_gross_income"] == 8500
        assert annual[1]["total_taxes"] == 810
        assert annual[1]["total_spending"] == 6200
        assert annual[1]["total_surplus_deficit"] == 1490


class TestDeficitDetection:
    """Tests for deficit period identification."""
    
    def test_identify_sustained_deficit(self):
        """Test identifying sustained deficit periods."""
        net_projections = [
            NetIncomeProjection(
                month="2026-01", gross_cashflow=8000,
                estimated_federal_tax=600, estimated_state_tax=150,
                estimated_total_tax=750, net_income_after_tax=7250,
                inflation_adjusted_spending=6000, surplus_deficit=1250
            ),
            NetIncomeProjection(
                month="2026-02", gross_cashflow=7000,
                estimated_federal_tax=600, estimated_state_tax=150,
                estimated_total_tax=750, net_income_after_tax=6250,
                inflation_adjusted_spending=7000, surplus_deficit=-750  # Deficit
            ),
            NetIncomeProjection(
                month="2026-03", gross_cashflow=7000,
                estimated_federal_tax=600, estimated_state_tax=150,
                estimated_total_tax=750, net_income_after_tax=6250,
                inflation_adjusted_spending=7000, surplus_deficit=-750  # Deficit
            ),
            NetIncomeProjection(
                month="2026-04", gross_cashflow=7000,
                estimated_federal_tax=600, estimated_state_tax=150,
                estimated_total_tax=750, net_income_after_tax=6250,
                inflation_adjusted_spending=7000, surplus_deficit=-750  # Deficit
            ),
            NetIncomeProjection(
                month="2026-05", gross_cashflow=8000,
                estimated_federal_tax=600, estimated_state_tax=150,
                estimated_total_tax=750, net_income_after_tax=7250,
                inflation_adjusted_spending=6000, surplus_deficit=1250
            ),
        ]
        
        deficits = identify_deficit_periods(net_projections, consecutive_months=3)
        
        assert len(deficits) == 1
        
        deficit_period = deficits[0]
        assert deficit_period["start_month"] == "2026-02"
        assert deficit_period["end_month"] == "2026-04"
        assert deficit_period["months"] == 3
        assert abs(deficit_period["total_deficit"] - (-2250)) < 0.01  # -750 * 3
    
    def test_no_sustained_deficit(self):
        """Test when deficit is too short to flag."""
        net_projections = [
            NetIncomeProjection(
                month="2026-01", gross_cashflow=8000,
                estimated_federal_tax=600, estimated_state_tax=150,
                estimated_total_tax=750, net_income_after_tax=7250,
                inflation_adjusted_spending=6000, surplus_deficit=1250
            ),
            NetIncomeProjection(
                month="2026-02", gross_cashflow=7000,
                estimated_federal_tax=600, estimated_state_tax=150,
                estimated_total_tax=750, net_income_after_tax=6250,
                inflation_adjusted_spending=7000, surplus_deficit=-750  # Deficit
            ),
            NetIncomeProjection(
                month="2026-03", gross_cashflow=8000,
                estimated_federal_tax=600, estimated_state_tax=150,
                estimated_total_tax=750, net_income_after_tax=7250,
                inflation_adjusted_spending=6000, surplus_deficit=1250
            ),
        ]
        
        deficits = identify_deficit_periods(net_projections, consecutive_months=3)
        
        # Only 1 month of deficit, not 3+ consecutive
        assert len(deficits) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
