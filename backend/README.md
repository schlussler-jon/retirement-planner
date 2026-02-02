# Retirement Planner Backend

FastAPI backend for retirement planning application.

## Features

- **Projection Engine**: Monthly-first calculation of income, investments, and cash flow
- **Tax Calculations**: Federal and state tax with Social Security provisional income method
- **Google OAuth**: Secure authentication
- **Google Drive Storage**: User scenarios stored in Drive app folder
- **RESTful API**: Well-documented endpoints

## Tech Stack

- Python 3.11+
- FastAPI
- Pydantic (data validation)
- Google APIs (OAuth, Drive)
- pytest (testing)

## Setup

### 1. Install Dependencies

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install packages
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
# Copy template
cp .env.example .env

# Edit .env with your values
# Get credentials from Google Cloud Console
```

### 3. Run Tests

```bash
# All tests
pytest

# Specific test file
pytest tests/test_projection.py -v

# With coverage
pytest --cov=app tests/
```

### 4. Start Server

```bash
# Development
uvicorn app.main:app --reload

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Project Structure

```
backend/
├── app/
│   ├── main.py           # FastAPI app
│   ├── config.py         # Configuration
│   ├── models/
│   │   ├── scenario.py   # Pydantic models for inputs
│   │   └── outputs.py    # Pydantic models for outputs
│   ├── engine/
│   │   ├── projection.py # Core projection engine
│   │   ├── tax.py        # Tax calculations
│   │   ├── budget.py     # Budget projections
│   │   └── orchestrator.py # Combines all engines
│   └── api/
│       ├── auth.py       # OAuth endpoints
│       ├── scenarios.py  # Scenario CRUD
│       └── drive.py      # Drive integration
├── tests/
│   ├── test_projection.py
│   └── test_tax.py
├── requirements.txt
├── Dockerfile
└── README.md
```

## API Endpoints

### Authentication

- `GET /auth/login` - Initiate Google OAuth
- `GET /auth/callback` - OAuth callback
- `POST /auth/logout` - Logout
- `GET /auth/me` - Get current user

### Scenarios

- `GET /scenarios` - List user's scenarios
- `GET /scenarios/{id}` - Get scenario details
- `POST /scenarios` - Create new scenario
- `PUT /scenarios/{id}` - Update scenario
- `DELETE /scenarios/{id}` - Delete scenario
- `POST /scenarios/{id}/run` - Run projection
- `PATCH /scenarios/{id}/rename` - Rename scenario
- `POST /scenarios/{id}/duplicate` - Duplicate scenario

## Projection Engine

### Operation Order (Per Month)

1. **Income Streams**: Apply income with COLA adjustments
2. **Contributions**: Add to account balances
3. **Withdrawals**: Subtract from balances (counted as income)
4. **Growth**: Apply monthly compound interest

### COLA Logic

- Applied in specified month each year
- Not applied in the stream's start month
- Multiplies current amount by (1 + cola_percent_annual)

### Account Growth

```python
monthly_rate = (1 + annual_rate) ** (1/12) - 1
new_balance = (balance + contribution - withdrawal) * (1 + monthly_rate)
```

## Tax Calculations

### Social Security Taxation

```python
provisional_income = agi_excluding_ss + 0.5 * ss + tax_exempt_interest

# Thresholds (MFJ): $32,000 and $44,000
# Thresholds (Single): $25,000 and $34,000
# 0% taxable below base
# Up to 50% taxable between base and additional
# Up to 85% taxable above additional
```

### Federal Tax

- Progressive brackets (2024)
- Standard deduction
- Annual calculation, monthly estimation

### State Tax

- No-tax states: 0%
- Flat-rate states: Fixed percentage
- Progressive states: Approximate effective rate

## Testing

### Run Specific Tests

```bash
# Projection engine
pytest tests/test_projection.py::TestProjectionEngine::test_cola_application -v

# Tax calculations
pytest tests/test_tax.py::TestSocialSecurityTaxation -v
```

### Test Coverage

```bash
pytest --cov=app --cov-report=html tests/
# Open htmlcov/index.html
```

## Development

### Adding New Features

1. Add models to `app/models/`
2. Implement logic in `app/engine/`
3. Create API endpoints in `app/api/`
4. Write tests in `tests/`
5. Update documentation

### Code Style

```bash
# Format code
black app/ tests/

# Type checking
mypy app/

# Linting
flake8 app/ tests/
```

## Deployment

### Docker

```bash
# Build
docker build -t retirement-planner-backend .

# Run
docker run -p 8000:8000 --env-file .env retirement-planner-backend
```

### Railway

```bash
# Install CLI
npm install -g @railway/cli

# Deploy
railway up
```

See `docs/DEPLOYMENT.md` for detailed deployment instructions.

## Troubleshooting

### OAuth Issues

- Verify redirect URI matches exactly
- Check that Drive API is enabled
- Ensure OAuth consent screen is configured

### Calculation Issues

- Review test cases for expected behavior
- Check input data format
- Verify COLA application timing

### Import Errors

```bash
# If imports fail, ensure PYTHONPATH is set
export PYTHONPATH="${PYTHONPATH}:/path/to/backend"
```

## Contributing

1. Create feature branch
2. Make changes
3. Add tests
4. Run test suite
5. Submit pull request

## License

MIT License
