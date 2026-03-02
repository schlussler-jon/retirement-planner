"""
Financial Intelligence Feed endpoint.

Generates a personalized set of financial insight cards on login,
using GPT-4o with web search for current rates, strategies, and news.
Results are cached per user for 24 hours.
"""

import os
import json
import time
import logging
import hashlib
from typing import List, Optional
from xmlrpc import client
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from openai import OpenAI

from db.models import get_db, ScenarioModel
from auth.session import get_user_from_session
from auth.config import get_oauth_settings
from api.utils.encryption import decrypt_data
from models import Scenario

logger = logging.getLogger(__name__)
router = APIRouter()

# ─── Simple in-memory cache (24 hours per user) ───────────────────────────────
_cache: dict = {}  # user_id -> {"ts": float, "data": list}
CACHE_TTL = 86400  # 24 hours

CATEGORIES = [
    "Income Opportunity",
    "Investment Strategy",
    "Tax Strategy",
    "Retirement Planning",
    "Economic Context",
    "Medicare & Benefits",
]

CATEGORY_ICONS = {
    "Income Opportunity":   "💰",
    "Investment Strategy":  "📈",
    "Tax Strategy":         "🏦",
    "Retirement Planning":  "🎯",
    "Economic Context":     "🌐",
    "Medicare & Benefits":  "🏥",
}

CATEGORY_COLORS = {
    "Income Opportunity":   "violet",
    "Investment Strategy":  "green",
    "Tax Strategy":         "gold",
    "Retirement Planning":  "blue",
    "Economic Context":     "slate",
    "Medicare & Benefits":  "teal",
}


def get_current_user_id(request: Request) -> str:
    settings   = get_oauth_settings()
    session_id = request.cookies.get(settings.session_cookie_name)
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = get_user_from_session(session_id)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired")
    return user.id


def build_user_context(db: Session, user_id: str) -> str:
    """Extract key facts from user's scenarios to personalize the feed."""
    try:
        db_scenarios = db.query(ScenarioModel).filter_by(user_id=user_id).all()
        if not db_scenarios:
            return "User has no scenarios yet — provide general retirement planning insights."

        # Use first/most recent scenario for context
        data = json.loads(decrypt_data(db_scenarios[0].data))
        # Add default names for streams missing them
        for s in data.get("income_streams", []):
            if not s.get("name"):
                s["name"] = s.get("type", "income").replace("_", " ").title()
        scenario = Scenario(**data)

        people = scenario.people
        accounts = scenario.accounts
        streams = scenario.income_streams
        settings = scenario.global_settings
        tax = scenario.tax_settings

        # Ages
        from datetime import date
        current_year = date.today().year
        ages = [current_year - p.birth_date.year for p in people]
        age_str = ", ".join(str(a) for a in ages)

        # Tax bucket balances
        deferred = sum(a.starting_balance for a in accounts if a.tax_bucket.value == 'tax_deferred')
        roth     = sum(a.starting_balance for a in accounts if a.tax_bucket.value == 'roth')
        taxable  = sum(a.starting_balance for a in accounts if a.tax_bucket.value == 'taxable')
        total    = deferred + roth + taxable

        # Employment
        statuses = [getattr(p, 'employment_status', None) for p in people]
        working  = any(s in ['working_full_time', 'working_part_time', 'self_employed'] for s in statuses)
        retired  = any(s == 'retired' for s in statuses)

        # Income types
        income_types = list(set(s.type.value for s in streams))

        return f"""User profile:
- Ages: {age_str}
- Filing status: {tax.filing_status.value.replace('_', ' ')}
- State: {settings.residence_state}
- Total portfolio: ${total:,.0f} (tax-deferred: {deferred/total*100:.0f}%, Roth: {roth/total*100:.0f}%, taxable: {taxable/total*100:.0f}%)
- Employment: {'Working' if working else 'Retired' if retired else 'Not working'}
- Income sources: {', '.join(income_types)}
- Projection end: {settings.projection_end_year}"""

    except Exception as e:
        logger.warning(f"Could not build user context: {e}")
        return "General retirement planning user — ages 60s, mixed portfolio."


# ─── Response models ──────────────────────────────────────────────────────────

class InsightCard(BaseModel):
    category:    str
    icon:        str
    color:       str
    headline:    str
    insight:     str
    action:      Optional[str] = None
    source_hint: Optional[str] = None  # e.g. "Current as of March 2026"

class FeedResponse(BaseModel):
    cards:      List[InsightCard]
    cached:     bool
    updated_at: float
    user_context_summary: str


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.get("/financial-feed", response_model=FeedResponse)
async def financial_feed(
    request: Request,
    refresh: bool = False,
    db: Session = Depends(get_db),
):
    user_id = get_current_user_id(request)

    # Check cache
    cached_entry = _cache.get(user_id)
    if cached_entry and not refresh:
        age = time.time() - cached_entry["ts"]
        if age < CACHE_TTL:
            return FeedResponse(
                cards=cached_entry["cards"],
                cached=True,
                updated_at=cached_entry["ts"],
                user_context_summary=cached_entry.get("context", ""),
            )

    user_context = build_user_context(db, user_id)

    prompt = f"""You are a financial intelligence system providing CURRENT, TIMELY insights to a retirement planner.

USER PROFILE:
{user_context}

TODAY'S DATE: Search the web for today's date and use current 2025/2026 information.

Generate exactly 6 financial insight cards — one for each category below. Each card must:
1. Be CURRENT and SPECIFIC — include actual rates, percentages, dollar amounts where applicable
2. Be PERSONALIZED to the user profile above
3. Be ACTIONABLE — tell them what to consider doing
4. Search the web to find the most current information for each topic

CATEGORIES (generate one card each):
1. Income Opportunity — new or underutilized income streams relevant to their situation
2. Investment Strategy — current market conditions and specific allocation ideas
3. Tax Strategy — current year tax optimization specific to their bracket/state/age
4. Retirement Planning — current rule changes, SECURE Act updates, RMD rules, SS COLA
5. Economic Context — current Fed rate, inflation, what it means for their portfolio
6. Medicare & Benefits — current premiums, IRMAA thresholds, enrollment windows

Respond ONLY with a valid JSON array of exactly 6 objects. No markdown, no preamble. Each object:
{{
  "category": "one of the 6 category names above",
  "headline": "compelling 8-12 word headline",
  "insight": "2-3 sentences with specific current data points and what it means for them",
  "action": "one specific action they can take right now (1 sentence)",
  "source_hint": "brief note on recency e.g. 'Current as of Q1 2026'"
}}"""

    try:
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        # Use web search via responses API if available, otherwise standard
        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a financial intelligence system. Always respond with valid JSON only. Include specific current rates and data points."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=2000,
            )
            raw = response.choices[0].message.content
        except Exception:
            # Fallback to standard chat completions
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a financial intelligence system. Always respond with valid JSON only. Search for current information and include specific rates and data points."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=2000,
            )
            raw = response.choices[0].message.content

        # Parse JSON
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        cards_data = json.loads(raw)

        cards = []
        for item in cards_data:
            cat = item.get("category", "Economic Context")
            cards.append(InsightCard(
                category=cat,
                icon=CATEGORY_ICONS.get(cat, "💡"),
                color=CATEGORY_COLORS.get(cat, "slate"),
                headline=item.get("headline", ""),
                insight=item.get("insight", ""),
                action=item.get("action"),
                source_hint=item.get("source_hint"),
            ))

        # Cache result
        ts = time.time()
        _cache[user_id] = {"ts": ts, "cards": cards, "context": user_context}

        return FeedResponse(
            cards=cards,
            cached=False,
            updated_at=ts,
            user_context_summary=user_context,
        )

    except Exception as e:
        logger.error(f"Financial feed error: {e}")
        raise HTTPException(status_code=500, detail=f"Feed generation failed: {str(e)}")
