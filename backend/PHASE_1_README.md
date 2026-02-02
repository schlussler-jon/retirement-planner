# Phase 1: Core Foundation & Data Models

## Overview
Phase 1 provides the complete data modeling foundation for the retirement planning web app. All inputs, outputs, and configuration are defined using Pydantic models with full validation.

## What's Included

### ✅ Segment 1.1 - Core Models (3 min)
- **Person**: Individual in the retirement plan
- **IncomeStream**: Recurring income (pension, SSA, other) with COLA logic
- **InvestmentAccount**: Retirement/investment accounts with tax buckets
- **GlobalSettings**: Projection timeline and residence state

### ✅ Segment 1.2 - Budget & Tax Models (3 min)
- **BudgetCategory**: Individual spending categories
- **BudgetSettings**: Complete budget with inflation and survivor reduction
- **TaxSettings**: Filing status and tax configuration
- **StateTaxConfig**: State tax rate lookup

### ✅ Segment 1.3 - Output Models (3 min)
- **MonthlyProjection**: Month-by-month financial snapshot
- **AnnualSummary**: Yearly rollup data
- **TaxSummary**: Annual tax calculations
- **NetIncomeProjection**: Net income vs spending
- **ProjectionResults**: Complete projection output container

## Installation

### 1. Set Up Python Environment
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Linux/Mac)
source venv/bin/activate

# Activate (Windows)
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Verify Installation
```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=models --cov-report=html

# Run specific test file
pytest tests/test_models_core.py -v
```

## Usage Examples

### Creating a Person
```python
from datetime import date
from models import Person

person = Person(
    person_id="person_1",
    name="Jon",
    birth_date=date(1963, 6, 9),
    life_expectancy_years=83
)

print(person.death_year_month)  # "2046-06"
```

### Creating an Income Stream with COLA
```python
from models import IncomeStream, IncomeStreamType

pension = IncomeStream(
    stream_id="pension_jon",
    type=IncomeStreamType.PENSION,
    owner_person_id="person_1",
    start_month="2026-01",
    monthly_amount_at_start=8625.0,
    cola_percent_annual=0.02,  # 2% annual increase
    cola_month=5  # Applied in May each year
)
```

### Creating an Investment Account
```python
from models import InvestmentAccount, TaxBucket

account = InvestmentAccount(
    account_id="jon_457b",
    name="Jon 457b",
    tax_bucket=TaxBucket.TAX_DEFERRED,
    starting_balance=330000.0,
    annual_return_rate=0.06,  # 6% annual
    monthly_contribution=0.0,
    monthly_withdrawal=1900.0  # Reduces balance
)

# Monthly return rate is auto-calculated
print(account.monthly_return_rate)  # ~0.00487
```

### Creating a Complete Scenario
```python
from models import Scenario, GlobalSettings, TaxSettings, FilingStatus

scenario = Scenario(
    scenario_id="scenario_001",
    scenario_name="Base Retirement Plan",
    global_settings=GlobalSettings(
        projection_start_month="2026-01",
        projection_end_year=2056,
        residence_state="AZ"
    ),
    people=[person],
    income_streams=[pension],
    accounts=[account],
    tax_settings=TaxSettings(
        filing_status=FilingStatus.MARRIED_FILING_JOINTLY
    )
)

# Validate all references
scenario.validate_references()
```

### Serializing to JSON
```python
import json

# To JSON
scenario_json = scenario.model_dump_json(indent=2)
with open("my_scenario.json", "w") as f:
    f.write(scenario_json)

# From JSON
with open("my_scenario.json", "r") as f:
    data = json.load(f)
    loaded_scenario = Scenario(**data)
```

### Budget Configuration
```python
from models import BudgetSettings, BudgetCategory, CategoryType, SurvivorReductionMode

budget = BudgetSettings(
    categories=[
        BudgetCategory(
            category_name="Housing",
            category_type=CategoryType.FIXED,
            monthly_amount=1500.0
        ),
        BudgetCategory(
            category_name="Travel",
            category_type=CategoryType.FLEXIBLE,
            monthly_amount=400.0
        )
    ],
    inflation_annual_percent=0.025,  # 2.5% annual inflation
    survivor_flexible_reduction_percent=0.25,  # 25% reduction
    survivor_reduction_mode=SurvivorReductionMode.FLEX_ONLY
)

print(budget.total_monthly_spending())  # 1900.0
print(budget.total_fixed_spending())     # 1500.0
print(budget.total_flexible_spending())  # 400.0
```

## Key Validation Rules

### Person
- ✅ Birth date cannot be in the future
- ✅ Life expectancy 0-120 years
- ✅ Name must be non-empty

### IncomeStream
- ✅ Start month must be YYYY-MM format
- ✅ Monthly amount must be positive
- ✅ COLA percent 0-50%
- ✅ COLA month 1-12

### InvestmentAccount
- ✅ Starting balance ≥ 0
- ✅ Contributions ≥ 0
- ✅ Withdrawals ≥ 0 (positive number reduces balance)
- ✅ Annual return -50% to +50%

### Scenario
- ✅ Person IDs must be unique
- ✅ Stream IDs must be unique
- ✅ Account IDs must be unique
- ✅ Income streams must reference valid person IDs

## Example Scenario
See `schemas/example_scenario.json` for a complete working example based on the original Excel workbook.

## Running Tests

### All Tests
```bash
pytest
```

### Specific Test Classes
```bash
pytest tests/test_models_core.py::TestPerson -v
pytest tests/test_models_budget.py::TestBudgetSettings -v
```

### Coverage Report
```bash
pytest --cov=models --cov-report=html
# Open htmlcov/index.html in browser
```

### Expected Test Results
```
tests/test_models_budget.py ......... PASSED
tests/test_models_core.py ............ PASSED
tests/test_models_scenario.py ........ PASSED

======================== 40+ tests passed ========================
Coverage: 100%
```

## File Structure
```
backend/
├── models/
│   ├── __init__.py          # Package exports
│   ├── core.py              # Person, IncomeStream, InvestmentAccount
│   ├── budget.py            # Budget and Tax settings
│   ├── outputs.py           # Projection result models
│   └── scenario.py          # Main Scenario model
├── tests/
│   ├── test_models_core.py      # Core model tests
│   ├── test_models_budget.py    # Budget/tax model tests
│   └── test_models_scenario.py  # Scenario and output tests
├── schemas/
│   └── example_scenario.json    # Example scenario
├── requirements.txt         # Python dependencies
└── pytest.ini              # Test configuration
```

## What's Next?

Phase 1 is complete! You now have:
- ✅ All input data models with validation
- ✅ All output data models
- ✅ Complete test coverage
- ✅ Example scenario matching your Excel workbook

### Ready for Phase 2: Projection Engine
Phase 2 will implement the actual calculation logic:
- Timeline generation
- COLA application
- Account operations (contributions, withdrawals, growth)
- Monthly/annual aggregation

The projection engine will consume the models you just built and produce the output models.

## Troubleshooting

### Import Errors
If you get import errors, make sure you're in the backend directory and the virtual environment is activated:
```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
```

### Test Failures
If tests fail, check that you have the correct Python version (3.11+):
```bash
python --version  # Should be 3.11 or higher
```

### Validation Errors
Pydantic provides detailed error messages. Example:
```python
try:
    person = Person(
        person_id="p1",
        name="",  # Invalid: empty name
        birth_date=date(1963, 6, 9)
    )
except ValidationError as e:
    print(e.json())  # Detailed error info
```

## Notes

### COLA Logic (Critical Implementation Detail)
Income streams apply COLA increases in a specific month each year:
- `cola_month=1` → January increase
- `cola_month=5` → May increase
- Formula: `new_amount = current_amount × (1 + cola_percent_annual)`

This will be implemented in Phase 2's income processor.

### Withdrawal Convention (Critical)
Investment account withdrawals are POSITIVE numbers that:
1. REDUCE the account balance
2. COUNT as income/cashflow to the user
3. Are taxed based on the account's tax bucket

### Tax Buckets
- **tax_deferred**: Traditional 401k/IRA → withdrawals are ordinary income
- **roth**: Roth accounts → withdrawals are tax-free
- **taxable**: Brokerage accounts → v1 treats as ordinary income (simplified)

## License
Part of the Retirement Planning Web App project.
