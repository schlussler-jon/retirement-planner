"""
Roth Strategy endpoint.

Calculates:
  1. Projected RMD schedule under current plan
  2. Impact of Roth conversions on future RMDs and lifetime taxes
  3. Optimal conversion window and amount
"""

from fastapi import APIRouter, HTTPException, status, Request, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import logging
import json
from typing import List, Dict, Optional
from api.utils.encryption import decrypt_data

from models import Scenario
from db.models import get_db, ScenarioModel
from auth.session import get_user_from_session
from auth.config import get_oauth_settings

logger = logging.getLogger(__name__)
router = APIRouter()

# ─── IRS Uniform Lifetime Table (age -> distribution period) ─────────────────
# Source: IRS Publication 590-B (2024)
ULT = {
    72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
    78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7,
    84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9,
    90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94:  9.5, 95:  8.9,
    96:  8.4, 97:  7.8, 98:  7.3, 99:  6.8,100:  6.4,
}

# 2025 Federal tax brackets (married filing jointly)
BRACKETS_MFJ = [
    (23200,   0.10),
    (94300,   0.12),
    (201050,  0.22),
    (383900,  0.24),
    (487450,  0.32),
    (731200,  0.35),
    (float('inf'), 0.37),
]

BRACKETS_SINGLE = [
    (11600,   0.10),
    (47150,   0.12),
    (100525,  0.22),
    (191950,  0.24),
    (243725,  0.32),
    (609350,  0.35),
    (float('inf'), 0.37),
]

# 2025 Medicare IRMAA thresholds (MFJ) — triggers surcharge
IRMAA_THRESHOLD_MFJ    = 212000
IRMAA_THRESHOLD_SINGLE = 106000


def get_current_user_id(request: Request) -> str:
    settings   = get_oauth_settings()
    session_id = request.cookies.get(settings.session_cookie_name)
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = get_user_from_session(session_id)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired")
    return user.id


def load_scenario(scenario_id: str, user_id: str, db: Session) -> Scenario:
    db_s = db.query(ScenarioModel).filter_by(
        user_id=user_id, scenario_id=scenario_id
    ).first()
    if not db_s:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return Scenario(**json.loads(decrypt_data(db_s.data)))


def calc_tax(taxable_income: float, filing_status: str) -> float:
    """Calculate federal income tax using 2025 brackets."""
    brackets = BRACKETS_MFJ if filing_status == 'married_filing_jointly' else BRACKETS_SINGLE
    tax  = 0.0
    prev = 0.0
    for ceiling, rate in brackets:
        if taxable_income <= prev:
            break
        taxable_in_bracket = min(taxable_income, ceiling) - prev
        tax  += taxable_in_bracket * rate
        prev  = ceiling
    return tax


def marginal_rate(taxable_income: float, filing_status: str) -> float:
    """Return marginal tax rate for given income."""
    brackets = BRACKETS_MFJ if filing_status == 'married_filing_jointly' else BRACKETS_SINGLE
    prev = 0.0
    for ceiling, rate in brackets:
        if taxable_income <= ceiling:
            return rate
        prev = ceiling
    return 0.37


def standard_deduction(filing_status: str, year: int) -> float:
    """2025 standard deduction (indexed roughly 3%/yr)."""
    base = 29200 if filing_status == 'married_filing_jointly' else 14600
    return base * (1.03 ** max(0, year - 2025))


def project_rmd_scenario(
    deferred_balance: float,
    birth_year: int,
    start_year: int,
    end_year: int,
    growth_rate: float,
    annual_income: float,          # non-RMD income (SS, pension, etc.)
    filing_status: str,
    annual_conversion: float = 0,  # Roth conversion amount per year
    conversion_start_year: int = 0,
    conversion_end_year: int = 0,
    roth_balance: float = 0,
) -> List[Dict]:
    """
    Project RMDs year by year with optional Roth conversions.

    Returns list of annual records with:
      year, age, deferred_balance, rmd_amount, conversion_amount,
      total_taxable_income, federal_tax, effective_rate, irmaa_flag
    """
    results = []
    balance  = deferred_balance
    roth_bal = roth_balance

    for year in range(start_year, end_year + 1):
        age = year - birth_year

        # Apply growth at start of year
        balance  *= (1 + growth_rate)
        roth_bal *= (1 + growth_rate)

        # Roth conversion (before RMD, within conversion window)
        conversion = 0.0
        if (annual_conversion > 0
                and conversion_start_year <= year <= conversion_end_year
                and age < 73):
            conversion = min(annual_conversion, balance)
            balance   -= conversion
            roth_bal  += conversion

        # RMD calculation
        rmd = 0.0
        if age >= 73 and age in ULT and balance > 0:
            rmd     = balance / ULT[age]
            balance = max(0, balance - rmd)

        # Estimate taxable income
        std_ded      = standard_deduction(filing_status, year)
        taxable_inc  = max(0, annual_income + rmd + conversion - std_ded)
        fed_tax      = calc_tax(taxable_inc, filing_status)
        eff_rate     = (fed_tax / (annual_income + rmd + conversion)) if (annual_income + rmd + conversion) > 0 else 0

        # IRMAA flag
        irmaa_thresh = IRMAA_THRESHOLD_MFJ if filing_status == 'married_filing_jointly' else IRMAA_THRESHOLD_SINGLE
        irmaa_flag   = (annual_income + rmd + conversion) > irmaa_thresh

        results.append({
            "year":              year,
            "age":               age,
            "deferred_balance":  round(balance),
            "roth_balance":      round(roth_bal),
            "rmd_amount":        round(rmd),
            "conversion_amount": round(conversion),
            "total_income":      round(annual_income + rmd + conversion),
            "taxable_income":    round(taxable_inc),
            "federal_tax":       round(fed_tax),
            "effective_rate":    round(eff_rate * 100, 1),
            "irmaa_flag":        irmaa_flag,
        })

    return results


# ─── Response models ──────────────────────────────────────────────────────────

class RmdYear(BaseModel):
    year:              int
    age:               int
    deferred_balance:  float
    roth_balance:      float
    rmd_amount:        float
    conversion_amount: float
    total_income:      float
    taxable_income:    float
    federal_tax:       float
    effective_rate:    float
    irmaa_flag:        bool

class RothStrategyResponse(BaseModel):
    scenario_id:              str
    scenario_name:            str
    # Current plan (no conversions)
    baseline:                 List[RmdYear]
    baseline_lifetime_tax:    float
    baseline_peak_rmd:        float
    # With conversions
    optimized:                List[RmdYear]
    optimized_lifetime_tax:   float
    optimized_peak_rmd:       float
    # Conversion parameters used
    conversion_amount:        float
    conversion_start_year:    int
    conversion_end_year:      int
    # Summary
    lifetime_tax_savings:     float
    rmd_reduction_pct:        float
    conversion_window_years:  int
    oldest_person_name:       str
    oldest_birth_year:        int
    deferred_balance:         float
    roth_balance:             float
    filing_status:            str
    weighted_return:          float


# ─── Request model ────────────────────────────────────────────────────────────

class RothStrategyRequest(BaseModel):
    conversion_amount:     Optional[float] = None   # None = auto-optimize
    conversion_start_year: Optional[int]   = None
    conversion_end_year:   Optional[int]   = None
    target_bracket:        Optional[float] = 0.22   # Fill to this bracket


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/scenarios/{scenario_id}/roth-strategy", response_model=RothStrategyResponse)
async def roth_strategy(
    scenario_id: str,
    params: RothStrategyRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    user_id  = get_current_user_id(request)
    scenario = load_scenario(scenario_id, user_id, db)

    filing_status = scenario.tax_settings.filing_status.value
    start_year    = int(scenario.global_settings.projection_start_month.split('-')[0])
    end_year      = scenario.global_settings.projection_end_year

    # Find oldest person (drives RMD age)
    if not scenario.people:
        raise HTTPException(status_code=400, detail="No people in scenario")

    oldest = min(scenario.people, key=lambda p: p.birth_date.year)
    birth_year = oldest.birth_date.year

    # Portfolio balances by bucket
    deferred_balance = sum(
        a.starting_balance for a in scenario.accounts
        if a.tax_bucket.value == 'tax_deferred'
    )
    roth_balance = sum(
        a.starting_balance for a in scenario.accounts
        if a.tax_bucket.value == 'roth'
    )

    # Weighted return rate
    total_bal = sum(a.starting_balance for a in scenario.accounts) or 1
    weighted_return = sum(
        a.starting_balance * a.annual_return_rate
        for a in scenario.accounts
    ) / total_bal

    # Estimate annual non-RMD income (SS + pension) from income streams
    annual_income = 0.0
    for stream in scenario.income_streams:
        if stream.type.value in ('social_security', 'pension', 'annuity'):
            annual_income += (stream.monthly_amount_at_start or 0) * 12

    # ── Determine conversion window ───────────────────────────────────────
    retirement_year = start_year  # default: already retired
    for person in scenario.people:
        if person.planned_retirement_date:
            ret_yr = int(person.planned_retirement_date.split('-')[0])
            retirement_year = max(retirement_year, ret_yr)

    rmd_start_year    = birth_year + 73
    conv_start        = params.conversion_start_year or max(start_year, retirement_year)
    conv_end          = params.conversion_end_year   or max(conv_start, rmd_start_year - 1)
    conv_window_years = max(1, conv_end - conv_start + 1)

    # ── Auto-optimize conversion amount ──────────────────────────────────
    if params.conversion_amount is None:
        # Fill to target bracket ceiling each year
        target_bracket = params.target_bracket or 0.22
        brackets       = BRACKETS_MFJ if filing_status == 'married_filing_jointly' else BRACKETS_SINGLE
        bracket_ceiling = 0.0
        for ceiling, rate in brackets:
            if rate >= target_bracket:
                bracket_ceiling = ceiling
                break
        std_ded         = standard_deduction(filing_status, conv_start)
        # How much room in bracket after existing income?
        income_after_deduction = max(0, annual_income - std_ded)
        room_in_bracket        = max(0, bracket_ceiling - income_after_deduction)
        conversion_amount      = round(room_in_bracket / 1000) * 1000  # round to nearest $1K
    else:
        conversion_amount = params.conversion_amount

    # ── Run baseline (no conversions) ────────────────────────────────────
    baseline = project_rmd_scenario(
        deferred_balance=deferred_balance,
        birth_year=birth_year,
        start_year=start_year,
        end_year=end_year,
        growth_rate=weighted_return,
        annual_income=annual_income,
        filing_status=filing_status,
    )

    # ── Run optimized (with conversions) ────────────────────────────────
    optimized = project_rmd_scenario(
        deferred_balance=deferred_balance,
        birth_year=birth_year,
        start_year=start_year,
        end_year=end_year,
        growth_rate=weighted_return,
        annual_income=annual_income,
        filing_status=filing_status,
        annual_conversion=conversion_amount,
        conversion_start_year=conv_start,
        conversion_end_year=conv_end,
        roth_balance=roth_balance,
    )

    baseline_lifetime_tax  = sum(r['federal_tax'] for r in baseline)
    optimized_lifetime_tax = sum(r['federal_tax'] for r in optimized)
    baseline_peak_rmd      = max((r['rmd_amount'] for r in baseline),  default=0)
    optimized_peak_rmd     = max((r['rmd_amount'] for r in optimized), default=0)
    lifetime_savings       = baseline_lifetime_tax - optimized_lifetime_tax
    rmd_reduction          = ((baseline_peak_rmd - optimized_peak_rmd) / baseline_peak_rmd * 100
                              if baseline_peak_rmd > 0 else 0)

    return RothStrategyResponse(
        scenario_id=scenario.scenario_id,
        scenario_name=scenario.scenario_name,
        baseline=[RmdYear(**r) for r in baseline],
        baseline_lifetime_tax=round(baseline_lifetime_tax),
        baseline_peak_rmd=round(baseline_peak_rmd),
        optimized=[RmdYear(**r) for r in optimized],
        optimized_lifetime_tax=round(optimized_lifetime_tax),
        optimized_peak_rmd=round(optimized_peak_rmd),
        conversion_amount=round(conversion_amount),
        conversion_start_year=conv_start,
        conversion_end_year=conv_end,
        lifetime_tax_savings=round(lifetime_savings),
        rmd_reduction_pct=round(rmd_reduction, 1),
        conversion_window_years=conv_window_years,
        oldest_person_name=oldest.name,
        oldest_birth_year=birth_year,
        deferred_balance=round(deferred_balance),
        roth_balance=round(roth_balance),
        filing_status=filing_status,
        weighted_return=round(weighted_return * 100, 2),
    )
