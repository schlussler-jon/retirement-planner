/**
 * GlobalSettingsTab
 *
 * Projection window, residence state, and spending adjustments
 * (inflation + survivor reduction, moved here from BudgetTab).
 */

import type { GlobalSettings, BudgetSettings } from '@/types/scenario'
import { US_STATES } from '@/types/scenario'

const SUPPORTED_STATE_CODES = [
  'AZ', 'CA', 'CO',
  'AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY'
]

interface Props {
  settings: GlobalSettings
  onChange: (s: GlobalSettings) => void
  budget: BudgetSettings
  onBudgetChange: (b: BudgetSettings) => void
}

const START_YEARS  = Array.from({ length: 11 }, (_, i) => 2024 + i)
const END_YEARS    = Array.from({ length: 76 }, (_, i) => 2024 + i)
const MONTHS       = Array.from({ length: 12 }, (_, i) => i + 1)
const MONTH_NAMES  = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December']

const toDisplay = (d: number) => Math.round(d * 10000) / 100
const toDecimal = (p: number) => p / 100
const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select()

export default function GlobalSettingsTab({ settings, onChange, budget, onBudgetChange }: Props) {
  const parts      = settings.projection_start_month.split('-')
  const startYear  = parseInt(parts[0], 10) || 2026
  const startMonth = parseInt(parts[1], 10) || 1

  const setStartYear  = (y: number) =>
    onChange({ ...settings, projection_start_month: `${y}-${String(startMonth).padStart(2,'0')}` })
  const setStartMonth = (m: number) =>
    onChange({ ...settings, projection_start_month: `${startYear}-${String(m).padStart(2,'0')}` })

  return (
    <div>
      <p className="font-sans text-slate-300 text-xs mb-5">
        Define the projection window, your state of residence, and how spending adjusts over time.
      </p>

      {/* ── Projection Window ── */}
      <p className="font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
        Projection Window
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Start Year</label>
          <select value={startYear} onChange={e => setStartYear(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer focus:border-gold-600 focus:outline-none">
            {START_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div>
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Start Month</label>
          <select value={startMonth} onChange={e => setStartMonth(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer focus:border-gold-600 focus:outline-none">
            {MONTHS.map(m => <option key={m} value={m}>{MONTH_NAMES[m-1]}</option>)}
          </select>
        </div>

        <div>
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">End Year</label>
          <select value={settings.projection_end_year} onChange={e => onChange({ ...settings, projection_end_year: Number(e.target.value) })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer focus:border-gold-600 focus:outline-none">
            {END_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="sm:col-span-3 max-w-xs">
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Residence State</label>
          <select value={settings.residence_state} onChange={e => onChange({ ...settings, residence_state: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer focus:border-gold-600 focus:outline-none">
            {US_STATES.filter(s => SUPPORTED_STATE_CODES.includes(s.code)).map(s =>
              <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
            )}
          </select>
          <p className="font-sans text-slate-400 text-xs mt-1">Showing states with tax support (AZ, CA, CO) and no-income-tax states.</p>
        </div>
      </div>

      {/* ── Inflation & Survivor Settings ── */}
      <div className="border-t border-slate-800 pt-5">
        <p className="font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
          Inflation &amp; Survivor Settings
        </p>
        <p className="font-sans text-slate-400 text-xs mb-4">
          How spending changes over time and if one spouse passes away.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Annual Inflation
            </label>
            <div className="relative">
              <input
                type="number"
                value={toDisplay(budget.inflation_annual_percent)}
                min={0} max={20} step={0.1}
                onFocus={handleFocus}
                onChange={e => {
                  const v = e.target.valueAsNumber
                  onBudgetChange({ ...budget, inflation_annual_percent: isNaN(v) ? 0 : toDecimal(v) })
                }}
                className="w-full min-w-0 bg-slate-800 border border-slate-700 rounded-lg px-3 pr-7 py-2 text-white font-sans text-sm focus:border-gold-600 focus:outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 font-sans text-sm">%</span>
            </div>
            <p className="font-sans text-slate-400 text-xs mt-1">How much spending grows each year (2.5% is typical)</p>
          </div>

          <div>
            <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Survivor Spending Reduction
            </label>
            <div className="relative">
              <input
                type="number"
                value={toDisplay(budget.survivor_flexible_reduction_percent)}
                min={0} max={100} step={5}
                onFocus={handleFocus}
                onChange={e => {
                  const v = e.target.valueAsNumber
                  onBudgetChange({ ...budget, survivor_flexible_reduction_percent: isNaN(v) ? 0 : toDecimal(v) })
                }}
                className="w-full min-w-0 bg-slate-800 border border-slate-700 rounded-lg px-3 pr-7 py-2 text-white font-sans text-sm focus:border-gold-600 focus:outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 font-sans text-sm">%</span>
            </div>
            <p className="font-sans text-slate-400 text-xs mt-1">Spending cut when one spouse passes (e.g. 20%)</p>
          </div>

          <div>
            <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Reduction Applies To
            </label>
            <select
              value={budget.survivor_reduction_mode}
              onChange={e => onBudgetChange({ ...budget, survivor_reduction_mode: e.target.value as BudgetSettings['survivor_reduction_mode'] })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer focus:border-gold-600 focus:outline-none"
            >
              <option value="flex_only">Flexible categories only</option>
              <option value="all">All categories</option>
            </select>
            <p className="font-sans text-slate-400 text-xs mt-1">Which expenses get reduced</p>
          </div>
        </div>
      </div>
    </div>
  )
}
