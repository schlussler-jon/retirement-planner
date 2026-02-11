/**
 * BudgetTab
 *
 * Budget categories with main category, name, type, amount, optional end date.
 */

import type { BudgetSettings, BudgetCategory } from '@/types/scenario'
import { CATEGORY_TYPES, EXPENSE_CATEGORIES }  from '@/types/scenario'

interface Props {
  budget: BudgetSettings
  onChange: (budget: BudgetSettings) => void
}

const toDisplay = (d: number) => Math.round(d * 10000) / 100
const toDecimal = (p: number) => p / 100

function updateAt<T>(arr: T[], idx: number, fn: (item: T) => T): T[] {
  return arr.map((item, i) => (i === idx ? fn(item) : item))
}

export default function BudgetTab({ budget, onChange }: Props) {
  const setCats = (categories: BudgetCategory[]) => onChange({ ...budget, categories })

  const addCategory = () =>
    setCats([
      ...budget.categories,
      {
        category_name: '',
        category_type: 'fixed',
        monthly_amount: 0,
        include: true,
        main_category: 'Giving & Miscellaneous',
        end_month: null
      }
    ])

  const removeCategory = (idx: number) =>
    setCats(budget.categories.filter((_, i) => i !== idx))

  const updateCategory = (idx: number, fn: (c: BudgetCategory) => BudgetCategory) =>
    setCats(updateAt(budget.categories, idx, fn))

  // live totals
  const included      = budget.categories.filter(c => c.include)
  const totalFixed    = included.filter(c => c.category_type === 'fixed').reduce((s, c) => s + c.monthly_amount, 0)
  const totalFlexible = included.filter(c => c.category_type === 'flexible').reduce((s, c) => s + c.monthly_amount, 0)
  const totalMonthly  = totalFixed + totalFlexible

  return (
    <div>
      <p className="font-sans text-slate-500 text-xs mb-5">
        Define monthly spending categories. Fixed expenses stay constant; flexible expenses can be reduced for survivors.
      </p>

      {budget.categories.length === 0 && (
        <p className="font-sans text-slate-600 text-sm text-center py-4">No budget categories added yet.</p>
      )}

      {/* category rows */}
      <div className={`divide-y divide-slate-800 ${budget.categories.length > 0 ? 'mb-4' : ''}`}>
        {budget.categories.map((cat, idx) => (
          <div key={idx} className="py-3 first:pt-0">
            {/* Row 1: checkbox, category dropdown, name */}
            <div className="flex items-center gap-2.5 mb-2">
              {/* include toggle */}
              <input type="checkbox" checked={cat.include}
                onChange={e => updateCategory(idx, c => ({ ...c, include: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-700 bg-slate-800 cursor-pointer accent-gold-600 shrink-0" />

              {/* main category dropdown */}
              <select value={cat.main_category || 'Giving & Miscellaneous'}
                onChange={e => updateCategory(idx, c => ({ ...c, main_category: e.target.value as BudgetCategory['main_category'] }))}
                className="w-56 shrink-0 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-sans text-sm cursor-pointer">
                {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>

              {/* name */}
              <input type="text" value={cat.category_name}
                onChange={e => updateCategory(idx, c => ({ ...c, category_name: e.target.value }))}
                placeholder="e.g. Mortgage Payment"
                className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-sans text-sm placeholder-slate-600" />

              {/* delete */}
              <button onClick={() => removeCategory(idx)}
                className="font-sans text-slate-600 hover:text-danger text-lg leading-none transition-colors shrink-0" title="Remove category">×</button>
            </div>

            {/* Row 2: type, amount, end date */}
            <div className="flex items-center gap-2.5 ml-6">
              {/* type */}
              <select value={cat.category_type}
                onChange={e => updateCategory(idx, c => ({ ...c, category_type: e.target.value as BudgetCategory['category_type'] }))}
                className="w-28 shrink-0 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-sans text-sm cursor-pointer">
                {CATEGORY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>

              {/* amount */}
              <div className="relative w-32 shrink-0">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-sans text-sm">$</span>
                <input type="number" value={cat.monthly_amount} min={0} step={50}
                  onChange={e => {
                    const v = e.target.valueAsNumber
                    updateCategory(idx, c => ({ ...c, monthly_amount: isNaN(v) ? 0 : v }))
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-6 pr-2 py-1.5 text-white font-sans text-sm" />
              </div>

              {/* end date */}
              <div className="flex items-center gap-2">
                <label className="font-sans text-slate-500 text-xs whitespace-nowrap">Ends:</label>
                <input type="month" value={cat.end_month || ''}
                  onChange={e => updateCategory(idx, c => ({ ...c, end_month: e.target.value || null }))}
                  placeholder="YYYY-MM"
                  className="w-40 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-sans text-sm" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* add category button */}
      <button onClick={addCategory}
        className="w-full border border-slate-700 border-dashed rounded-lg px-4 py-2.5 font-sans text-slate-500 hover:text-gold-500 hover:border-gold-600 text-sm transition-colors duration-150 mb-5">
        + Add Category
      </button>

      {/* monthly total summary */}
      {budget.categories.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg px-4 py-3 mb-6 flex flex-wrap justify-between items-center gap-2">
          <div className="flex gap-6">
            <span className="font-sans text-slate-500 text-xs">
              Fixed: <span className="text-slate-300 font-semibold">${totalFixed.toLocaleString()}</span>
            </span>
            <span className="font-sans text-slate-500 text-xs">
              Flexible: <span className="text-slate-300 font-semibold">${totalFlexible.toLocaleString()}</span>
            </span>
          </div>
          <span className="font-sans text-slate-400 text-xs font-semibold">
            Total: <span className="text-gold-500">${totalMonthly.toLocaleString()}/mo</span>
          </span>
        </div>
      )}

      {/* ── inflation & survivor settings ── */}
      <div className="border-t border-slate-800 pt-5">
        <p className="font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">
          Inflation &amp; Survivor Settings
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* inflation */}
          <div>
            <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Annual Inflation (%)
            </label>
            <div className="relative">
              <input type="number" value={toDisplay(budget.inflation_annual_percent)} min={0} max={20} step={0.1}
                onChange={e => {
                  const v = e.target.valueAsNumber
                  onChange({ ...budget, inflation_annual_percent: isNaN(v) ? 0 : toDecimal(v) })
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 pr-7 py-2 text-white font-sans text-sm" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-sans text-sm">%</span>
            </div>
            <p className="font-sans text-slate-600 text-xs mt-1">Applied annually to all spending.</p>
          </div>

          {/* survivor reduction % */}
          <div>
            <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Survivor Reduction (%)
            </label>
            <div className="relative">
              <input type="number" value={toDisplay(budget.survivor_flexible_reduction_percent)} min={0} max={100} step={5}
                onChange={e => {
                  const v = e.target.valueAsNumber
                  onChange({ ...budget, survivor_flexible_reduction_percent: isNaN(v) ? 0 : toDecimal(v) })
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 pr-7 py-2 text-white font-sans text-sm" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-sans text-sm">%</span>
            </div>
            <p className="font-sans text-slate-600 text-xs mt-1">Spending cut when one spouse passes.</p>
          </div>

          {/* survivor mode */}
          <div>
            <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Reduction Applies To
            </label>
            <select value={budget.survivor_reduction_mode}
              onChange={e => onChange({ ...budget, survivor_reduction_mode: e.target.value as BudgetSettings['survivor_reduction_mode'] })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer">
              <option value="flex_only">Flexible categories only</option>
              <option value="all">All categories</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
