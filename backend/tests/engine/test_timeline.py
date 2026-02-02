"""
Unit tests for timeline module.

Tests month iteration, date parsing, and timeline utilities.
"""

import pytest
from engine.timeline import (
    Timeline,
    month_is_before,
    month_is_after,
    months_between
)


class TestTimeline:
    """Tests for Timeline class."""
    
    def test_basic_timeline(self):
        """Test creating a basic timeline."""
        timeline = Timeline("2026-01", 2026)
        
        months = list(timeline.months())
        assert len(months) == 12  # January through December
        
        # Check first month
        first_month, first_num = months[0]
        assert first_month == "2026-01"
        assert first_num == 1
        
        # Check last month
        last_month, last_num = months[-1]
        assert last_month == "2026-12"
        assert last_num == 12
    
    def test_multi_year_timeline(self):
        """Test timeline spanning multiple years."""
        timeline = Timeline("2026-01", 2028)
        
        months = list(timeline.months())
        assert len(months) == 36  # 3 years * 12 months
        
        # Check progression
        assert months[0][0] == "2026-01"
        assert months[11][0] == "2026-12"
        assert months[12][0] == "2027-01"
        assert months[35][0] == "2028-12"
    
    def test_partial_year_start(self):
        """Test starting mid-year."""
        timeline = Timeline("2026-06", 2026)
        
        months = list(timeline.months())
        assert len(months) == 7  # June through December
        
        assert months[0][0] == "2026-06"
        assert months[-1][0] == "2026-12"
    
    def test_total_months(self):
        """Test total_months calculation."""
        timeline1 = Timeline("2026-01", 2026)
        assert timeline1.total_months() == 12
        
        timeline2 = Timeline("2026-01", 2030)
        assert timeline2.total_months() == 60  # 5 years
        
        timeline3 = Timeline("2026-06", 2026)
        assert timeline3.total_months() == 7
    
    def test_get_year(self):
        """Test extracting year from month string."""
        timeline = Timeline("2026-01", 2026)
        
        assert timeline.get_year("2026-01") == 2026
        assert timeline.get_year("2030-12") == 2030
    
    def test_get_month_number(self):
        """Test extracting month number."""
        timeline = Timeline("2026-01", 2026)
        
        assert timeline.get_month_number("2026-01") == 1
        assert timeline.get_month_number("2026-12") == 12
        assert timeline.get_month_number("2027-06") == 6
    
    def test_is_year_end(self):
        """Test detecting December."""
        timeline = Timeline("2026-01", 2026)
        
        assert timeline.is_year_end("2026-12") is True
        assert timeline.is_year_end("2026-11") is False
        assert timeline.is_year_end("2026-01") is False
    
    def test_is_year_start(self):
        """Test detecting January."""
        timeline = Timeline("2026-01", 2026)
        
        assert timeline.is_year_start("2026-01") is True
        assert timeline.is_year_start("2027-01") is True
        assert timeline.is_year_start("2026-02") is False
        assert timeline.is_year_start("2026-12") is False
    
    def test_next_month(self):
        """Test getting next month."""
        timeline = Timeline("2026-01", 2026)
        
        assert timeline.next_month("2026-01") == "2026-02"
        assert timeline.next_month("2026-12") == "2027-01"
        assert timeline.next_month("2026-06") == "2026-07"
    
    def test_previous_month(self):
        """Test getting previous month."""
        timeline = Timeline("2026-01", 2026)
        
        assert timeline.previous_month("2026-02") == "2026-01"
        assert timeline.previous_month("2027-01") == "2026-12"
        assert timeline.previous_month("2026-06") == "2026-05"
    
    def test_is_first_occurrence_of_month(self):
        """Test detecting specific month."""
        timeline = Timeline("2026-01", 2026)
        
        # May is month 5
        assert timeline.is_first_occurrence_of_month("2026-05", 5) is True
        assert timeline.is_first_occurrence_of_month("2026-06", 5) is False
        
        # January is month 1
        assert timeline.is_first_occurrence_of_month("2026-01", 1) is True
        assert timeline.is_first_occurrence_of_month("2027-01", 1) is True


class TestMonthComparison:
    """Tests for month comparison utilities."""
    
    def test_month_is_before(self):
        """Test month_is_before function."""
        assert month_is_before("2026-01", "2026-02") is True
        assert month_is_before("2026-01", "2027-01") is True
        assert month_is_before("2026-12", "2027-01") is True
        
        assert month_is_before("2026-02", "2026-01") is False
        assert month_is_before("2027-01", "2026-01") is False
        assert month_is_before("2026-01", "2026-01") is False  # Same month
    
    def test_month_is_after(self):
        """Test month_is_after function."""
        assert month_is_after("2026-02", "2026-01") is True
        assert month_is_after("2027-01", "2026-01") is True
        assert month_is_after("2027-01", "2026-12") is True
        
        assert month_is_after("2026-01", "2026-02") is False
        assert month_is_after("2026-01", "2027-01") is False
        assert month_is_after("2026-01", "2026-01") is False  # Same month
    
    def test_months_between(self):
        """Test calculating months between two dates."""
        # Same month
        assert months_between("2026-01", "2026-01") == 1
        
        # Same year
        assert months_between("2026-01", "2026-12") == 12
        assert months_between("2026-06", "2026-08") == 3
        
        # Different years
        assert months_between("2026-01", "2027-01") == 13
        assert months_between("2026-01", "2028-01") == 25
        
        # Multiple years
        assert months_between("2026-01", "2030-12") == 60


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
