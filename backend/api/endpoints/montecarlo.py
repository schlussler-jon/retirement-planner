"""
Monte Carlo simulation endpoint.

Runs 1,000 retirement projections with randomized annual returns to show
the range of possible outcomes and calculate a plan success rate.
"""

from fastapi import APIRouter, HTTPException, status, Request, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import logging
import json
import numpy as np
from typing import List, Dict
from api.utils.encryption import decrypt_data

from models import Scenario
from db.models import get_db, ScenarioModel
from auth.session import get_user_from_session
from auth.config import get_oauth_settings

logger = logging.getLogger(__name__)
router = APIRouter()

# ─── Auth + DB helpers ────────────────────────────────────────────────────

def get_current_user_id(request: Request) -> str:
    settings = get_oauth_settings()
    session_id = request.cookies.get(settings.session_cookie_name)
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = get_user_from_session(session_id)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired")
    return user.id


def load_scenario(scenario_id: str, user_id: str, db: Session) -> Scenario:
    db_scenario = db.query(ScenarioModel).filter_by(
        user_id=user_id,
        scenario_id=scenario_id,
    ).first()
    if not db_scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario '{scenario_id}' not found",
        )
    return Scenario(**json.loads(decrypt_data(db_scenario.data)))


# ─── Monte Carlo simulation ───────────────────────────────────────────────

SIMULATIONS      = 1000
MARKET_STD_DEV   = 0.12   # Historical S&P 500 annual std deviation
SEQUENCE_PENALTY = 0.03   # Extra volatility for sequence-of-returns risk

def run_monte_carlo(scenario: Scenario) -> Dict:
    """
    Run Monte Carlo simulation.

    Simplified model that focuses on portfolio growth with randomized returns.
    Income, spending, and contributions are treated as deterministic (fixed).
    Only investment returns are randomized.

    Returns percentile bands, success rate, and median trajectory.
    """
    # Build timeline
    start_month = scenario.global_settings.projection_start_month
    end_year    = scenario.global_settings.projection_end_year
    start_year, start_m = map(int, start_month.split('-'))
    total_months = (end_year - start_year) * 12 + (13 - start_m)

    # Starting portfolio
    starting_portfolio = sum(acc.starting_balance for acc in scenario.accounts)

    # Per-account mean annual returns and tax buckets
    accounts = scenario.accounts

    # Monthly net cash flow (contributions - withdrawals) per account
    # These are deterministic — only returns are randomized
    def monthly_net_cashflow(month_index: int) -> float:
        """Net cash into/out of portfolio this month (contributions minus withdrawals)."""
        year_month_year  = start_year + (start_m - 1 + month_index) // 12
        year_month_month = (start_m - 1 + month_index) % 12 + 1
        ym = f"{year_month_year}-{year_month_month:02d}"

        net = 0.0
        for acc in accounts:
            # Contribution
            contrib_active = True
            if acc.contribution_start_month and ym < acc.contribution_start_month:
                contrib_active = False
            if acc.contribution_end_month and ym > acc.contribution_end_month:
                contrib_active = False
            if contrib_active:
                net += acc.monthly_contribution

            # Withdrawal
            withdraw_active = True
            if acc.withdrawal_start_month and ym < acc.withdrawal_start_month:
                withdraw_active = False
            if acc.withdrawal_end_month and ym > acc.withdrawal_end_month:
                withdraw_active = False
            if withdraw_active:
                net -= acc.monthly_withdrawal

        return net

    # Pre-compute deterministic monthly cash flows
    monthly_cashflows = [monthly_net_cashflow(i) for i in range(total_months)]

    # Weighted mean annual return across all accounts by starting balance
    total_balance = starting_portfolio or 1.0
    weighted_mean_return = sum(
        acc.starting_balance * (acc.expected_annual_return / 100.0)
        for acc in accounts
    ) / total_balance if total_balance > 0 else 0.07

    # Run simulations
    # Each simulation: draw random annual returns, apply month by month
    all_trajectories = np.zeros((SIMULATIONS, total_months))

    rng = np.random.default_rng(seed=42)

    # Number of years in projection
    n_years = (total_months + 11) // 12

    for sim in range(SIMULATIONS):
        # Draw one annual return per year
        annual_returns = rng.normal(
            loc=weighted_mean_return,
            scale=MARKET_STD_DEV,
            size=n_years
        )
        # Convert to monthly returns
        monthly_returns = [(1 + r) ** (1/12) - 1 for r in annual_returns]

        balance = starting_portfolio
        for m in range(total_months):
            year_idx = m // 12
            monthly_rate = monthly_returns[year_idx]

            # Apply cash flow first, then growth
            balance += monthly_cashflows[m]
            balance = max(0.0, balance)  # Can't go below zero
            balance *= (1 + monthly_rate)

            all_trajectories[sim, m] = balance

    # Calculate percentile bands (annual snapshots — every 12th month)
    annual_indices = list(range(11, total_months, 12))  # end of each year
    if not annual_indices:
        annual_indices = [total_months - 1]

    years = [start_year + i + 1 for i in range(len(annual_indices))]

    percentiles_10 = [float(np.percentile(all_trajectories[:, i], 10)) for i in annual_indices]
    percentiles_25 = [float(np.percentile(all_trajectories[:, i], 25)) for i in annual_indices]
    percentiles_50 = [float(np.percentile(all_trajectories[:, i], 50)) for i in annual_indices]
    percentiles_75 = [float(np.percentile(all_trajectories[:, i], 75)) for i in annual_indices]
    percentiles_90 = [float(np.percentile(all_trajectories[:, i], 90)) for i in annual_indices]

    # Success rate: % of simulations where portfolio never hits zero
    final_balances = all_trajectories[:, -1]
    success_count  = int(np.sum(final_balances > 0))
    success_rate   = round(success_count / SIMULATIONS * 100, 1)

    # Median final balance
    median_final = float(np.median(final_balances))

    # Worst / best case final
    worst_final = float(np.percentile(final_balances, 5))
    best_final  = float(np.percentile(final_balances, 95))

    return {
        "years":          years,
        "percentile_10":  percentiles_10,
        "percentile_25":  percentiles_25,
        "percentile_50":  percentiles_50,
        "percentile_75":  percentiles_75,
        "percentile_90":  percentiles_90,
        "success_rate":   success_rate,
        "simulations":    SIMULATIONS,
        "starting_portfolio": starting_portfolio,
        "median_final":   median_final,
        "worst_final":    worst_final,
        "best_final":     best_final,
        "weighted_mean_return": round(weighted_mean_return * 100, 2),
    }


# ─── Response model ───────────────────────────────────────────────────────

class MonteCarloResponse(BaseModel):
    scenario_id:          str
    scenario_name:        str
    years:                List[int]
    percentile_10:        List[float]
    percentile_25:        List[float]
    percentile_50:        List[float]
    percentile_75:        List[float]
    percentile_90:        List[float]
    success_rate:         float
    simulations:          int
    starting_portfolio:   float
    median_final:         float
    worst_final:          float
    best_final:           float
    weighted_mean_return: float


# ─── Endpoint ─────────────────────────────────────────────────────────────

@router.post("/scenarios/{scenario_id}/montecarlo", response_model=MonteCarloResponse)
async def run_monte_carlo_simulation(
    scenario_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """Run Monte Carlo simulation for a scenario."""
    user_id  = get_current_user_id(request)
    scenario = load_scenario(scenario_id, user_id, db)

    try:
        logger.info(f"Running Monte Carlo for: {scenario_id}")
        result = run_monte_carlo(scenario)
        logger.info(f"Monte Carlo complete: {result['success_rate']}% success rate")

        return MonteCarloResponse(
            scenario_id=scenario.scenario_id,
            scenario_name=scenario.scenario_name,
            **result,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Monte Carlo error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Monte Carlo simulation failed: {str(e)}",
        )
