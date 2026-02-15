/**
 * Scenario input types.
 *
 * These mirror the Python Pydantic models in backend/models/ exactly.
 * Field names use snake_case to match the JSON the API sends/receives.
 */

// ─── Enums ────────────────────────────────────────────────────────────────

export type TaxBucket = 'taxable' | 'tax_deferred' | 'roth'

export type IncomeStreamType = 'pension' | 'social_security' | 'salary' | 'self_employment' | 'other'

export type CategoryType = 'fixed' | 'flexible'

export type FilingStatus =
  | 'single'
  | 'married_filing_jointly'
  | 'married_filing_separately'
  | 'head_of_household'

export type SurvivorReductionMode = 'flex_only' | 'all'

// ─── Core Models (models/core.py) ────────────────────────────────────────

export interface GlobalSettings {
  projection_start_month: string   // YYYY-MM
  projection_end_year: number      // e.g. 2056
  residence_state: string          // 2-letter code, e.g. "AZ"
}

export interface Person {
  person_id: string
  name: string
  birth_date: string               // YYYY-MM-DD
  life_expectancy_years?: number | null
  /** Computed by backend — read-only. */
  death_year_month?: string | null
}

export interface IncomeStream {
  stream_id: string
  type: IncomeStreamType
  owner_person_id: string
  start_month: string              // YYYY-MM
  end_month?: string | null        // YYYY-MM (optional)
  monthly_amount_at_start: number  // > 0
  cola_percent_annual: number      // 0–0.5  (e.g. 0.02 = 2 %)
  cola_month: number               // 1–12
}

export interface InvestmentAccount {
  account_id: string
  name: string
  tax_bucket: TaxBucket
  starting_balance: number         // >= 0
  annual_return_rate: number       // -0.5 – 0.5
  monthly_contribution: number     // >= 0
  contribution_start_month?: string | null    // YYYY-MM (optional)
  contribution_end_month?: string | null      // YYYY-MM (optional)
  monthly_withdrawal: number       // >= 0
  withdrawal_start_month?: string | null      // YYYY-MM (optional)
  withdrawal_end_month?: string | null        // YYYY-MM (optional)
  receives_surplus: boolean        // If true, surplus/deficit flows into/out of this account
  /** Computed by backend — read-only. */
  monthly_return_rate?: number
}

// ─── Budget Models (models/budget.py) ────────────────────────────────────

export const EXPENSE_CATEGORIES = [
  "Housing",
  "Utilities & Communications",
  "Food & Household",
  "Transportation",
  "Insurance & Healthcare",
  "Debt Payments",
  "Savings & Investing",
  "Family & Personal",
  "Entertainment & Lifestyle",
  "Giving & Miscellaneous"
] as const

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]

export interface BudgetCategory {
  category_name: string
  category_type: 'fixed' | 'flexible'
  monthly_amount: number
  include: boolean
  main_category: ExpenseCategory
  end_month?: string | null  // YYYY-MM format
}

export interface BudgetSettings {
  categories: BudgetCategory[]
  inflation_annual_percent: number                  // 0–0.2
  survivor_flexible_reduction_percent: number       // 0–1
  survivor_reduction_mode: SurvivorReductionMode
}

export interface TaxSettings {
  filing_status: FilingStatus
  standard_deduction_override?: number | null
  tax_year_ruleset: number         // e.g. 2024
}

// ─── Top-level Scenario (models/scenario.py) ─────────────────────────────
// NOTE: on the installed backend the field is budget_settings
//       (renamed from the original "budget" via sed during Phase 4 install).

export interface Scenario {
  scenario_id: string
  scenario_name: string
  description: string
  global_settings: GlobalSettings
  people: Person[]
  income_streams: IncomeStream[]
  accounts: InvestmentAccount[]
  budget_settings: BudgetSettings
  tax_settings: TaxSettings
}

// ─── Convenience: a partial scenario used while the user is editing ──────

export type ScenarioInput = Omit<Scenario, 'scenario_id'> & {
  scenario_id?: string
}

// ─── Static lookup tables used by the UI ─────────────────────────────────

export const TAX_BUCKETS: { value: TaxBucket; label: string }[] = [
  { value: 'taxable',       label: 'Taxable' },
  { value: 'tax_deferred',  label: 'Tax-Deferred (401k / 457b / IRA)' },
  { value: 'roth',          label: 'Roth (Tax-Free)' },
]

export const INCOME_STREAM_TYPES: { value: IncomeStreamType; label: string }[] = [
  { value: 'pension',          label: 'Pension' },
  { value: 'social_security',  label: 'Social Security' },
  { value: 'salary',           label: 'Salary' },
  { value: 'self_employment',  label: 'Self Employment' },
  { value: 'other',            label: 'Other' },
]

export const FILING_STATUSES: { value: FilingStatus; label: string }[] = [
  { value: 'single',                      label: 'Single' },
  { value: 'married_filing_jointly',      label: 'Married Filing Jointly' },
  { value: 'married_filing_separately',   label: 'Married Filing Separately' },
  { value: 'head_of_household',           label: 'Head of Household' },
]

export const CATEGORY_TYPES: { value: CategoryType; label: string }[] = [
  { value: 'fixed',    label: 'Fixed' },
  { value: 'flexible', label: 'Flexible' },
]

export const US_STATES: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
]
