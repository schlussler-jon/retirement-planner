#!/usr/bin/env python3
"""
Phase 5 Validation Script

This script validates that the API is working correctly.
Run this after installing dependencies to verify your setup.
"""

import sys
import json
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from fastapi.testclient import TestClient
from api.main import app
from api.endpoints.scenarios_inmemory import scenarios_db

client = TestClient(app)


def test_health_check():
    """Test API health check."""
    print("✓ Testing Health Check...")
    
    response = client.get("/api/health")
    assert response.status_code == 200
    
    data = response.json()
    assert data["status"] == "healthy"
    
    print(f"  ✓ API Status: {data['status']}")
    print(f"  ✓ Python Version: {data['python_version']}")


def test_scenario_crud():
    """Test scenario CRUD operations."""
    print("✓ Testing Scenario CRUD...")
    
    # Clear any existing scenarios
    scenarios_db.clear()
    
    # Create scenario
    scenario = {
        "scenario_id": "test",
        "scenario_name": "Test Scenario",
        "global_settings": {
            "projection_start_month": "2026-01",
            "projection_end_year": 2028,
            "residence_state": "AZ"
        },
        "people": [
            {
                "person_id": "p1",
                "name": "Test Person",
                "birth_date": "1970-01-01",
                "life_expectancy_years": 85
            }
        ],
        "income_streams": [
            {
                "stream_id": "pension",
                "type": "pension",
                "owner_person_id": "p1",
                "start_month": "2026-01",
                "monthly_amount_at_start": 5000.0,
                "cola_percent_annual": 0.02,
                "cola_month": 1
            }
        ],
        "accounts": [
            {
                "account_id": "401k",
                "name": "401k",
                "tax_bucket": "tax_deferred",
                "starting_balance": 300000.0,
                "annual_return_rate": 0.06,
                "monthly_contribution": 0.0,
                "monthly_withdrawal": 1500.0
            }
        ],
        "budget_settings": {
            "categories": [
                {
                    "category_name": "Housing",
                    "category_type": "fixed",
                    "monthly_amount": 2000.0,
                    "include": True
                }
            ],
            "inflation_annual_percent": 0.03
        },
        "tax_settings": {
            "filing_status": "single"
        }
    }
    
    # Create
    response = client.post("/api/scenarios", json=scenario)
    assert response.status_code == 201
    print("  ✓ Created scenario")
    
    # Read
    response = client.get("/api/scenarios/test")
    assert response.status_code == 200
    print("  ✓ Retrieved scenario")
    
    # Update
    scenario["scenario_name"] = "Updated Name"
    response = client.put("/api/scenarios/test", json=scenario)
    assert response.status_code == 200
    print("  ✓ Updated scenario")
    
    # List
    response = client.get("/api/scenarios")
    assert response.status_code == 200
    assert response.json()["count"] == 1
    print("  ✓ Listed scenarios")
    
    # Delete
    response = client.delete("/api/scenarios/test")
    assert response.status_code == 204
    print("  ✓ Deleted scenario")


def test_validation():
    """Test scenario validation."""
    print("✓ Testing Validation...")
    
    valid_scenario = {
        "scenario_id": "valid",
        "scenario_name": "Valid",
        "global_settings": {
            "projection_start_month": "2026-01",
            "projection_end_year": 2028,
            "residence_state": "CA"
        },
        "people": [],
        "income_streams": [],
        "accounts": [],
        "budget_settings": {
            "categories": [],
            "inflation_annual_percent": 0.0
        },
        "tax_settings": {
            "filing_status": "single"
        }
    }
    
    response = client.post("/api/scenarios/validate", json=valid_scenario)
    assert response.status_code == 200
    
    data = response.json()
    assert data["valid"] is True
    print("  ✓ Valid scenario validated")
    
    # Invalid scenario
    invalid_scenario = {"scenario_id": "invalid"}
    
    response = client.post("/api/scenarios/validate", json=invalid_scenario)
    assert response.status_code == 200
    
    data = response.json()
    assert data["valid"] is False
    assert "errors" in data
    print("  ✓ Invalid scenario detected")


def test_projection():
    """Test projection calculation."""
    print("✓ Testing Projection Calculation...")
    
    # Clear scenarios
    scenarios_db.clear()
    
    # Create scenario
    scenario = {
        "scenario_id": "projection_test",
        "scenario_name": "Projection Test",
        "global_settings": {
            "projection_start_month": "2026-01",
            "projection_end_year": 2026,  # Just one year for speed
            "residence_state": "AZ"
        },
        "people": [
            {
                "person_id": "p1",
                "name": "Test",
                "birth_date": "1970-01-01",
                "life_expectancy_years": 85
            }
        ],
        "income_streams": [
            {
                "stream_id": "pension",
                "type": "pension",
                "owner_person_id": "p1",
                "start_month": "2026-01",
                "monthly_amount_at_start": 5000.0
            }
        ],
        "accounts": [
            {
                "account_id": "401k",
                "name": "401k",
                "tax_bucket": "tax_deferred",
                "starting_balance": 200000.0,
                "annual_return_rate": 0.06,
                "monthly_withdrawal": 1000.0
            }
        ],
        "budget_settings": {
            "categories": [
                {
                    "category_name": "Spending",
                    "category_type": "fixed",
                    "monthly_amount": 3000.0,
                    "include": True
                }
            ],
            "inflation_annual_percent": 0.03
        },
        "tax_settings": {
            "filing_status": "single"
        }
    }
    
    client.post("/api/scenarios", json=scenario)
    
    # Calculate projection
    response = client.post("/api/scenarios/projection_test/projection")
    assert response.status_code == 200
    
    data = response.json()
    assert "financial_summary" in data
    assert "monthly_projections" in data
    
    summary = data["financial_summary"]
    print(f"  ✓ Calculated projection ({data['calculation_time_ms']:.2f}ms)")
    print(f"  ✓ Total Gross Income: ${summary['total_gross_income']:,.0f}")
    print(f"  ✓ Total Taxes: ${summary['total_taxes']:,.0f}")
    print(f"  ✓ Total Spending: ${summary['total_spending']:,.0f}")
    print(f"  ✓ Total Surplus: ${summary['total_surplus_deficit']:,.0f}")


def test_quick_projection():
    """Test quick projection."""
    print("✓ Testing Quick Projection...")
    
    response = client.post("/api/scenarios/projection_test/projection/quick")
    assert response.status_code == 200
    
    data = response.json()
    print(f"  ✓ Quick projection ({data['calculation_time_ms']:.2f}ms)")
    print(f"  ✓ Starting Portfolio: ${data['starting_portfolio']:,.0f}")
    print(f"  ✓ Ending Portfolio: ${data['ending_portfolio']:,.0f}")
    print(f"  ✓ Portfolio Growth: ${data['portfolio_growth']:,.0f}")


def main():
    """Run all validation tests."""
    print("=" * 70)
    print("PHASE 5 VALIDATION - API Endpoints")
    print("=" * 70)
    print()
    
    try:
        test_health_check()
        print()
        
        test_scenario_crud()
        print()
        
        test_validation()
        print()
        
        test_projection()
        print()
        
        test_quick_projection()
        print()
        
        print("=" * 70)
        print("✅ ALL VALIDATION TESTS PASSED!")
        print("=" * 70)
        print()
        print("Phase 5 is ready. You can now:")
        print("  1. Run unit tests: pytest tests/api/ -v")
        print("  2. Start the server: uvicorn api.main:app --reload")
        print("  3. View docs: http://localhost:8000/api/docs")
        print("  4. Move to Phase 6: Google OAuth & Drive Integration")
        print()
        print("🎉 API is complete!")
        print("   You can now make HTTP requests to calculate projections!")
        print()
        
        return 0
        
    except Exception as e:
        print()
        print("=" * 70)
        print("❌ VALIDATION FAILED!")
        print("=" * 70)
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
