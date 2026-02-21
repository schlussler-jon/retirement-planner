/**
 * API response types.
 *
 * These mirror the JSON shapes returned by every FastAPI endpoint.
 */

// ─── Auth endpoints (api/endpoints/auth.py) ─────────────────────────────

export interface AuthUser {
  id: string
  email: string
  name: string
  picture: string | null
  email_verified: boolean
}

export interface AuthStatus {
  authenticated: boolean
  user: {
    email: string
    name: string
    picture: string | null
  } | null
}

// ─── Scenario endpoints (api/endpoints/scenarios.py) ─────────────────────

export interface ScenarioCreateResponse {
  scenario_id: string
  scenario_name: string
  message: string
}

export interface ScenarioListItem {
  scenario_id: string
  scenario_name: string
  people_count: number
  income_streams_count: number
  accounts_count: number
}

export interface ScenarioListResponse {
  scenarios: ScenarioListItem[]
  count: number
}

export interface ValidationResponse {
  valid: boolean
  errors: string[] | null
  warnings: string[] | null
}

// ─── Projection output types (models/outputs.py) ─────────────────────────

export interface MonthlyProjection {
  month: string                                        // YYYY-MM
  income_by_stream: Record<string, number>
  withdrawals_by_account: Record<string, number>
  withdrawals_by_tax_bucket: Record<string, number>
  balances_by_account: Record<string, number>
  balances_by_tax_bucket: Record<string, number>
  total_investments: number
  total_gross_cashflow: number
  filing_status: string | null
}

export interface AnnualSummary {
  year: number
  total_income_year: number
  end_of_year_total_investments: number
}

export interface TaxSummary {
  year: number
  total_ssa_income: number
  taxable_ssa_income: number
  other_ordinary_income: number
  agi: number
  standard_deduction: number
  taxable_income: number
  federal_tax: number
  state_tax: number
  total_tax: number
  effective_tax_rate: number
}

export interface NetIncomeProjection {
  month: string                            // YYYY-MM
  gross_cashflow: number
  estimated_federal_tax: number
  estimated_state_tax: number
  net_income_after_tax: number
  inflation_adjusted_spending: number
  survivor_spending_applied: number | null
  surplus_deficit: number
}

export interface FinancialSummary {
  total_gross_income: number
  total_taxes: number
  total_spending: number
  total_surplus_deficit: number
  average_monthly_surplus_deficit: number
  months_in_surplus: number
  months_in_deficit: number
}

// ─── Full projection response (api/endpoints/projections.py) ─────────────

export interface ProjectionResponse {
  scenario_id: string
  scenario_name: string
  calculation_time_ms: number
  monthly_projections: MonthlyProjection[] | null
  annual_summaries: AnnualSummary[] | null
  tax_summaries: TaxSummary[] | null
  net_income_projections: NetIncomeProjection[] | null
  financial_summary: FinancialSummary
  portfolio_series: number[] | null
}

// ─── Quick projection response ────────────────────────────────────────────

export interface QuickProjectionResponse {
  scenario_id: string
  scenario_name: string
  calculation_time_ms: number
  total_months: number
  starting_portfolio: number
  ending_portfolio: number
  portfolio_growth: number
  financial_summary: FinancialSummary
  portfolio_series: number[]
}

// ─── Drive endpoints (api/endpoints/drive.py) ────────────────────────────

export interface DriveSaveResponse {
  scenario_id: string
  file_id: string
  message: string
}

export interface DriveScenarioItem {
  scenario_id: string
  file_id: string
  modified_time: string | null
  size: string | null
}

export interface DriveListResponse {
  scenarios: DriveScenarioItem[]
  count: number
}

export interface DriveDeleteResponse {
  scenario_id: string
  message: string
}

// ─── Generic API error shape ──────────────────────────────────────────────

export interface ApiError {
  detail: string
}
