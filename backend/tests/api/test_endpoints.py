"""
API endpoint tests.

Tests all API endpoints using FastAPI TestClient.
"""

import pytest
from fastapi.testclient import TestClient
from datetime import date

from api.main import app
from api.endpoints.scenarios_inmemory import scenarios_db

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_scenarios():
    """Clear scenarios database before each test."""
    scenarios_db.clear()
    yield
    scenarios_db.clear()


@pytest.fixture
def sample_scenario():
    """Sample scenario for testing."""
    return {
        "scenario_id": "test_scenario",
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
                },
                {
                    "category_name": "Food",
                    "category_type": "flexible",
                    "monthly_amount": 800.0,
                    "include": True
                }
            ],
            "inflation_annual_percent": 0.03
        },
        "tax_settings": {
            "filing_status": "single"
        }
    }


class TestHealthEndpoints:
    """Tests for health check endpoints."""
    
    def test_health_check(self):
        """Test basic health check."""
        response = client.get("/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "python_version" in data
    
    def test_readiness_check(self):
        """Test readiness check."""
        response = client.get("/api/health/ready")
        assert response.status_code == 200
        
        data = response.json()
        assert data["ready"] is True


class TestScenarioEndpoints:
    """Tests for scenario CRUD endpoints."""
    
    def test_create_scenario(self, sample_scenario):
        """Test creating a scenario."""
        response = client.post("/api/scenarios", json=sample_scenario)
        assert response.status_code == 201
        
        data = response.json()
        assert data["scenario_id"] == "test_scenario"
        assert data["scenario_name"] == "Test Scenario"
        assert "message" in data
    
    def test_create_duplicate_scenario(self, sample_scenario):
        """Test creating duplicate scenario fails."""
        # Create first time
        client.post("/api/scenarios", json=sample_scenario)
        
        # Try to create again
        response = client.post("/api/scenarios", json=sample_scenario)
        assert response.status_code == 409
    
    def test_create_invalid_scenario(self):
        """Test creating invalid scenario fails."""
        invalid = {
            "scenario_id": "invalid",
            "scenario_name": "Invalid",
            # Missing required fields
        }
        
        response = client.post("/api/scenarios", json=invalid)
        assert response.status_code == 400
    
    def test_get_scenario(self, sample_scenario):
        """Test retrieving a scenario."""
        # Create scenario
        client.post("/api/scenarios", json=sample_scenario)
        
        # Get scenario
        response = client.get("/api/scenarios/test_scenario")
        assert response.status_code == 200
        
        data = response.json()
        assert data["scenario_id"] == "test_scenario"
        assert data["scenario_name"] == "Test Scenario"
    
    def test_get_nonexistent_scenario(self):
        """Test getting nonexistent scenario fails."""
        response = client.get("/api/scenarios/nonexistent")
        assert response.status_code == 404
    
    def test_update_scenario(self, sample_scenario):
        """Test updating a scenario."""
        # Create scenario
        client.post("/api/scenarios", json=sample_scenario)
        
        # Update scenario
        sample_scenario["scenario_name"] = "Updated Name"
        response = client.put("/api/scenarios/test_scenario", json=sample_scenario)
        assert response.status_code == 200
        
        # Verify update
        response = client.get("/api/scenarios/test_scenario")
        data = response.json()
        assert data["scenario_name"] == "Updated Name"
    
    def test_update_nonexistent_scenario(self, sample_scenario):
        """Test updating nonexistent scenario fails."""
        response = client.put("/api/scenarios/nonexistent", json=sample_scenario)
        assert response.status_code == 404
    
    def test_delete_scenario(self, sample_scenario):
        """Test deleting a scenario."""
        # Create scenario
        client.post("/api/scenarios", json=sample_scenario)
        
        # Delete scenario
        response = client.delete("/api/scenarios/test_scenario")
        assert response.status_code == 204
        
        # Verify deleted
        response = client.get("/api/scenarios/test_scenario")
        assert response.status_code == 404
    
    def test_delete_nonexistent_scenario(self):
        """Test deleting nonexistent scenario fails."""
        response = client.delete("/api/scenarios/nonexistent")
        assert response.status_code == 404
    
    def test_list_scenarios(self, sample_scenario):
        """Test listing all scenarios."""
        # Create scenario
        client.post("/api/scenarios", json=sample_scenario)
        
        # List scenarios
        response = client.get("/api/scenarios")
        assert response.status_code == 200
        
        data = response.json()
        assert data["count"] == 1
        assert len(data["scenarios"]) == 1
        assert data["scenarios"][0]["scenario_id"] == "test_scenario"
    
    def test_validate_scenario(self, sample_scenario):
        """Test scenario validation."""
        response = client.post("/api/scenarios/validate", json=sample_scenario)
        assert response.status_code == 200
        
        data = response.json()
        assert data["valid"] is True
    
    def test_validate_invalid_scenario(self):
        """Test validation of invalid scenario."""
        invalid = {
            "scenario_id": "invalid",
            # Missing required fields
        }
        
        response = client.post("/api/scenarios/validate", json=invalid)
        assert response.status_code == 200  # Validation endpoint returns 200
        
        data = response.json()
        assert data["valid"] is False
        assert "errors" in data


class TestProjectionEndpoints:
    """Tests for projection calculation endpoints."""
    
    def test_calculate_projection(self, sample_scenario):
        """Test calculating a complete projection."""
        # Create scenario
        client.post("/api/scenarios", json=sample_scenario)
        
        # Calculate projection
        response = client.post("/api/scenarios/test_scenario/projection")
        assert response.status_code == 200
        
        data = response.json()
        assert data["scenario_id"] == "test_scenario"
        assert "calculation_time_ms" in data
        assert "financial_summary" in data
        assert "monthly_projections" in data
        assert "annual_summaries" in data
        
        # Check financial summary
        summary = data["financial_summary"]
        assert "total_gross_income" in summary
        assert "total_taxes" in summary
        assert "total_spending" in summary
        assert "total_surplus_deficit" in summary
    
    def test_projection_nonexistent_scenario(self):
        """Test projection for nonexistent scenario fails."""
        response = client.post("/api/scenarios/nonexistent/projection")
        assert response.status_code == 404
    
    def test_projection_with_options(self, sample_scenario):
        """Test projection with custom options."""
        # Create scenario
        client.post("/api/scenarios", json=sample_scenario)
        
        # Calculate projection with minimal data
        request = {
            "include_monthly": False,
            "include_annual": False,
            "include_tax_summary": False,
            "include_net_income": False
        }
        
        response = client.post("/api/scenarios/test_scenario/projection", json=request)
        assert response.status_code == 200
        
        data = response.json()
        assert "financial_summary" in data
        assert data.get("monthly_projections") is None
        assert data.get("annual_summaries") is None
    
    def test_quick_projection(self, sample_scenario):
        """Test quick projection endpoint."""
        # Create scenario
        client.post("/api/scenarios", json=sample_scenario)
        
        # Calculate quick projection
        response = client.post("/api/scenarios/test_scenario/projection/quick")
        assert response.status_code == 200
        
        data = response.json()
        assert data["scenario_id"] == "test_scenario"
        assert "calculation_time_ms" in data
        assert "starting_portfolio" in data
        assert "ending_portfolio" in data
        assert "financial_summary" in data


class TestRootEndpoint:
    """Tests for root endpoint."""
    
    def test_root(self):
        """Test root endpoint."""
        response = client.get("/")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "version" in data
        assert "docs" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
