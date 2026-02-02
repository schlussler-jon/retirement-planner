"""
Unit tests for income processor and COLA logic.

COLA (Cost of Living Adjustment) is a critical feature.
These tests verify that increases are applied correctly.
"""

import pytest
from datetime import date
from models import IncomeStream, IncomeStreamType
from engine.income import IncomeProcessor, IncomeState


class TestIncomeState:
    """Tests for IncomeState class."""
    
    def test_initial_state(self):
        """Test initial state of income stream."""
        stream = IncomeStream(
            stream_id="test",
            type=IncomeStreamType.PENSION,
            owner_person_id="p1",
            start_month="2026-01",
            monthly_amount_at_start=1000.0
        )
        
        state = IncomeState(stream)
        assert state.current_amount == 1000.0
        assert state.last_cola_year is None
    
    def test_cola_application(self):
        """Test COLA increase application."""
        stream = IncomeStream(
            stream_id="test",
            type=IncomeStreamType.PENSION,
            owner_person_id="p1",
            start_month="2026-01",
            monthly_amount_at_start=1000.0,
            cola_percent_annual=0.02,  # 2% annual
            cola_month=5  # May
        )
        
        state = IncomeState(stream)
        
        # Before COLA month - no change
        state.apply_cola_if_due("2026-04", 4)
        assert state.current_amount == 1000.0
        
        # COLA month - should increase
        state.apply_cola_if_due("2026-05", 5)
        assert abs(state.current_amount - 1020.0) < 0.01  # 1000 * 1.02
        
        # Same year, same month again - no additional increase
        state.apply_cola_if_due("2026-05", 5)
        assert abs(state.current_amount - 1020.0) < 0.01  # Still 1020
    
    def test_cola_multiple_years(self):
        """Test COLA over multiple years."""
        stream = IncomeStream(
            stream_id="test",
            type=IncomeStreamType.PENSION,
            owner_person_id="p1",
            start_month="2026-01",
            monthly_amount_at_start=1000.0,
            cola_percent_annual=0.03,  # 3% annual
            cola_month=1  # January
        )
        
        state = IncomeState(stream)
        
        # Year 1 - January
        state.apply_cola_if_due("2026-01", 1)
        assert abs(state.current_amount - 1030.0) < 0.01  # 1000 * 1.03
        
        # Year 2 - January
        state.apply_cola_if_due("2027-01", 1)
        assert abs(state.current_amount - 1060.9) < 0.01  # 1030 * 1.03
        
        # Year 3 - January
        state.apply_cola_if_due("2028-01", 1)
        assert abs(state.current_amount - 1092.73) < 0.01  # 1060.9 * 1.03
    
    def test_no_cola(self):
        """Test stream with no COLA (0%)."""
        stream = IncomeStream(
            stream_id="test",
            type=IncomeStreamType.PENSION,
            owner_person_id="p1",
            start_month="2026-01",
            monthly_amount_at_start=1000.0,
            cola_percent_annual=0.0,  # No COLA
            cola_month=1
        )
        
        state = IncomeState(stream)
        
        # Try to apply COLA
        state.apply_cola_if_due("2026-01", 1)
        assert state.current_amount == 1000.0  # No change
        
        state.apply_cola_if_due("2027-01", 1)
        assert state.current_amount == 1000.0  # Still no change


class TestIncomeProcessor:
    """Tests for IncomeProcessor class."""
    
    def test_single_stream_before_start(self):
        """Test stream that hasn't started yet."""
        stream = IncomeStream(
            stream_id="future",
            type=IncomeStreamType.PENSION,
            owner_person_id="p1",
            start_month="2027-01",
            monthly_amount_at_start=2000.0
        )
        
        processor = IncomeProcessor([stream])
        
        # Before start month
        income = processor.process_month("2026-12", 12)
        assert income["future"] == 0.0
        
        # At start month
        income = processor.process_month("2027-01", 1)
        assert income["future"] == 2000.0
        
        # After start month
        income = processor.process_month("2027-02", 2)
        assert income["future"] == 2000.0
    
    def test_multiple_streams(self):
        """Test processing multiple income streams."""
        stream1 = IncomeStream(
            stream_id="pension",
            type=IncomeStreamType.PENSION,
            owner_person_id="p1",
            start_month="2026-01",
            monthly_amount_at_start=3000.0
        )
        
        stream2 = IncomeStream(
            stream_id="ssa",
            type=IncomeStreamType.SOCIAL_SECURITY,
            owner_person_id="p1",
            start_month="2026-01",
            monthly_amount_at_start=2000.0
        )
        
        processor = IncomeProcessor([stream1, stream2])
        
        income = processor.process_month("2026-01", 1)
        assert income["pension"] == 3000.0
        assert income["ssa"] == 2000.0
        
        total = processor.get_total_income(income)
        assert total == 5000.0
    
    def test_cola_timing_may(self):
        """Test COLA applied in May each year."""
        stream = IncomeStream(
            stream_id="pension",
            type=IncomeStreamType.PENSION,
            owner_person_id="p1",
            start_month="2026-01",
            monthly_amount_at_start=8625.0,
            cola_percent_annual=0.02,  # 2%
            cola_month=5  # May
        )
        
        processor = IncomeProcessor([stream])
        
        # January 2026 - no COLA yet
        income = processor.process_month("2026-01", 1)
        assert income["pension"] == 8625.0
        
        # April 2026 - still no COLA
        income = processor.process_month("2026-04", 4)
        assert income["pension"] == 8625.0
        
        # May 2026 - COLA applied!
        income = processor.process_month("2026-05", 5)
        expected = 8625.0 * 1.02  # 8797.50
        assert abs(income["pension"] - expected) < 0.01
        
        # June 2026 - same as May (COLA already applied)
        income = processor.process_month("2026-06", 6)
        assert abs(income["pension"] - expected) < 0.01
        
        # December 2026 - still same
        income = processor.process_month("2026-12", 12)
        assert abs(income["pension"] - expected) < 0.01
        
        # January 2027 - still at 2026 COLA level
        income = processor.process_month("2027-01", 1)
        assert abs(income["pension"] - expected) < 0.01
        
        # May 2027 - new COLA applied!
        income = processor.process_month("2027-05", 5)
        expected2 = expected * 1.02  # 8797.50 * 1.02 = 8973.45
        assert abs(income["pension"] - expected2) < 0.01
    
    def test_cola_timing_january(self):
        """Test COLA applied in January (SSA typical)."""
        stream = IncomeStream(
            stream_id="ssa",
            type=IncomeStreamType.SOCIAL_SECURITY,
            owner_person_id="p1",
            start_month="2026-01",
            monthly_amount_at_start=2597.0,
            cola_percent_annual=0.025,  # 2.5%
            cola_month=1  # January
        )
        
        processor = IncomeProcessor([stream])
        
        # January 2026 - COLA applied immediately
        income = processor.process_month("2026-01", 1)
        expected = 2597.0 * 1.025  # 2661.925
        assert abs(income["ssa"] - expected) < 0.01
        
        # December 2026 - same level
        income = processor.process_month("2026-12", 12)
        assert abs(income["ssa"] - expected) < 0.01
        
        # January 2027 - new COLA
        income = processor.process_month("2027-01", 1)
        expected2 = expected * 1.025
        assert abs(income["ssa"] - expected2) < 0.01
    
    def test_get_social_security_income(self):
        """Test extracting Social Security income."""
        pension = IncomeStream(
            stream_id="pension",
            type=IncomeStreamType.PENSION,
            owner_person_id="p1",
            start_month="2026-01",
            monthly_amount_at_start=3000.0
        )
        
        ssa = IncomeStream(
            stream_id="ssa",
            type=IncomeStreamType.SOCIAL_SECURITY,
            owner_person_id="p1",
            start_month="2026-01",
            monthly_amount_at_start=2000.0
        )
        
        processor = IncomeProcessor([pension, ssa])
        
        income = processor.process_month("2026-01", 1)
        ssa_income = processor.get_social_security_income(income)
        
        assert ssa_income == 2000.0
    
    def test_get_income_by_type(self):
        """Test grouping income by type."""
        streams = [
            IncomeStream(
                stream_id="pension1",
                type=IncomeStreamType.PENSION,
                owner_person_id="p1",
                start_month="2026-01",
                monthly_amount_at_start=3000.0
            ),
            IncomeStream(
                stream_id="pension2",
                type=IncomeStreamType.PENSION,
                owner_person_id="p2",
                start_month="2026-01",
                monthly_amount_at_start=1500.0
            ),
            IncomeStream(
                stream_id="ssa1",
                type=IncomeStreamType.SOCIAL_SECURITY,
                owner_person_id="p1",
                start_month="2026-01",
                monthly_amount_at_start=2000.0
            )
        ]
        
        processor = IncomeProcessor(streams)
        income = processor.process_month("2026-01", 1)
        by_type = processor.get_income_by_type(income)
        
        assert by_type["pension"] == 4500.0  # 3000 + 1500
        assert by_type["social_security"] == 2000.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
