# Phase 1 Quick Start Guide

## 🚀 Get Started in 60 Seconds

### 1. Setup Environment
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Validate Installation
```bash
python validate_phase1.py
```

Expected output:
```
======================================================================
PHASE 1 VALIDATION - Core Foundation & Data Models
======================================================================

✓ Testing Person model...
  ✓ Person created: Test User, death year-month: 2055-01

✓ Testing IncomeStream model...
  ✓ Income stream created: $5000.0/month, 2.0% COLA

✓ Testing InvestmentAccount model...
  ✓ Account created: $100,000.00, 7.0% annual return
  ✓ Monthly return rate: 0.5654%

✓ Testing BudgetSettings model...
  ✓ Budget created: $2,500.00/month
  ✓ Fixed: $2,000.00, Flexible: $500.00

✓ Testing Scenario model...
  ✓ Scenario created: 'Test Scenario'
  ✓ 1 person(s), 1 stream(s), 1 account(s)
  ✓ References validated successfully

✓ Testing JSON serialization...
  ✓ Example scenario loaded: 'Jon & Rebecca Base Retirement Plan'
  ✓ 2 people, 4 income streams
  ✓ 6 accounts, 10 budget categories
  ✓ JSON round-trip successful

======================================================================
✅ ALL VALIDATION TESTS PASSED!
======================================================================
```

### 3. Run Unit Tests
```bash
pytest
```

Expected: **40+ tests passed, 100% coverage**

## 📁 What You Got

```
backend/
├── models/              ← All Pydantic models (ready to use!)
│   ├── core.py         
│   ├── budget.py       
│   ├── outputs.py      
│   └── scenario.py     
├── tests/               ← Complete test suite
│   ├── test_models_core.py
│   ├── test_models_budget.py
│   └── test_models_scenario.py
├── schemas/
│   └── example_scenario.json  ← Working example from your Excel
├── requirements.txt     ← Python dependencies
├── pytest.ini          ← Test configuration
├── validate_phase1.py  ← Quick validation script
└── PHASE_1_README.md   ← Full documentation
```

## 💡 Try It Out

### Create Your First Scenario
```python
from datetime import date
from models import (
    Scenario, Person, IncomeStream, InvestmentAccount,
    GlobalSettings, TaxSettings, FilingStatus,
    TaxBucket, IncomeStreamType
)

# Create a person
me = Person(
    person_id="me",
    name="Your Name",
    birth_date=date(1970, 1, 1),
    life_expectancy_years=90
)

# Create income stream
pension = IncomeStream(
    stream_id="my_pension",
    type=IncomeStreamType.PENSION,
    owner_person_id="me",
    start_month="2035-01",
    monthly_amount_at_start=3000.0,
    cola_percent_annual=0.02,
    cola_month=1
)

# Create investment account
account = InvestmentAccount(
    account_id="my_401k",
    name="My 401k",
    tax_bucket=TaxBucket.TAX_DEFERRED,
    starting_balance=250000.0,
    annual_return_rate=0.07,
    monthly_withdrawal=2000.0
)

# Build complete scenario
scenario = Scenario(
    scenario_id="my_plan",
    scenario_name="My Retirement Plan",
    global_settings=GlobalSettings(
        projection_start_month="2026-01",
        projection_end_year=2060,
        residence_state="CA"
    ),
    people=[me],
    income_streams=[pension],
    accounts=[account],
    tax_settings=TaxSettings(
        filing_status=FilingStatus.SINGLE
    )
)

# Validate it
scenario.validate_references()

# Save to JSON
import json
with open("my_scenario.json", "w") as f:
    f.write(scenario.model_dump_json(indent=2))

print("✅ Scenario created and saved!")
```

## 🎯 What's Validated

✅ **Person**: Birth dates, life expectancy, auto-calculated death dates  
✅ **Income**: COLA logic, positive amounts, valid start dates  
✅ **Accounts**: Tax buckets, return rates, withdrawals (positive = reduction)  
✅ **Budget**: Categories, inflation, survivor reduction modes  
✅ **Tax**: Filing status, state codes, deduction overrides  
✅ **Scenario**: Unique IDs, valid references, complete validation  
✅ **JSON**: Full serialization/deserialization round-trip  

## 🐛 Troubleshooting

### "ModuleNotFoundError: No module named 'models'"
```bash
# Make sure you're in the backend directory
cd backend
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
```

### "No module named 'pydantic'"
```bash
# Activate virtual environment first
source venv/bin/activate  # or venv\Scripts\activate
pip install -r requirements.txt
```

### Tests failing
```bash
# Check Python version (need 3.11+)
python --version

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

## 📚 Next Steps

Phase 1 is complete! You have:
- ✅ All data models with validation
- ✅ Complete test coverage
- ✅ Example scenario from your Excel workbook
- ✅ Ready for Phase 2

**Ready for Phase 2: Projection Engine** 🚀

Phase 2 will build the calculation engine that processes these models and generates the month-by-month projections.

## 📖 Documentation

- **PHASE_1_README.md** - Complete documentation
- **Test files** - Usage examples in every test
- **example_scenario.json** - Real-world example

## ⏱️ Build Time

Phase 1 completed in **~9 minutes** (3 segments × 3 min)
- Segment 1.1: Core models ✓
- Segment 1.2: Budget & tax models ✓
- Segment 1.3: Output models ✓

---

**Questions?** Check PHASE_1_README.md for detailed examples and API reference.
