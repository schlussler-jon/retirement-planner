/**
 * BudgetTab
 *
 * Budget categories with main category, name, type, amount, optional end date.
 */

import { useEffect, useRef } from 'react'
import type { BudgetSettings, BudgetCategory } from '@/types/scenario'
import { CATEGORY_TYPES, EXPENSE_CATEGORIES } from '@/types/scenario'

interface Props {
  budget: BudgetSettings
  onChange: (budget: BudgetSettings) => void
  autoAdd?: boolean
  onAutoAddDone?: () => void
}

const toDisplay = (d: number) => Math.round(d * 10000) / 100
const toDecimal = (p: number) => p / 100

function updateAt<T>(arr: T[], idx: number, fn: (item: T) => T): T[] {
  return arr.map((item, i) => (i === idx ? fn(item) : item))
}

const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select()

export default function BudgetTab({ budget, onChange, autoAdd, onAutoAddDone }: Props) {
  const setCats = (categories: BudgetCategory[]) => onChange({ ...budget, categories })

  const addCategory = () =>
    setCats([
      ...budget.categories,
      {
        category_name: '',
        category_type: 'fixed',
        monthly_amount: 0,
        include: true,
        main_category: 'Housing',
        end_month: null,
      },
    ])

  const removeCategory = (idx: number) => setCats(budget.categories.filter((_, i) => i !== idx))

  const updateCategory = (idx: number, fn: (c: BudgetCategory) => BudgetCategory) =>
    setCats(updateAt(budget.categories, idx, fn))

  const didAutoAdd = useRef(false)
  useEffect(() => {
    if (autoAdd && !didAutoAdd.current) {
      didAutoAdd.current = true
      addCategory()
      onAutoAddDone?.()
    }
    if (!autoAdd) didAutoAdd.current = false
  }, [autoAdd])

  // totals
  const included      = budget.categories.filter(c => c.include)
  const totalFixed    = included.filter(c => c.category_type === 'fixed').reduce((s, c) => s + c.monthly_amount, 0)
  const totalFlexible = included.filter(c => c.category_type === 'flexible').reduce((s, c) => s + c.monthly_amount, 0)
  const totalMonthly  = totalFixed + totalFlexible

  return (
    <div>
      <p className="font-sans text-slate-400 text-sm mb-2">
        Define your expected monthly spending in retirement.
      </p>
      <p className="font-sans text-slate-300 text-xs mb-5">
        <strong className="text-slate-400">Fixed</strong> expenses stay the same every month (mortgage, insurance).
        <strong className="text-slate-400"> Flexible</strong> expenses can be reduced if one spouse passes away.
        Uncheck a category to exclude it from the projection without deleting it.
      </p>

      {budget.categories.length === 0 && (
        <div className="text-center py-8 border border-dashed border-slate-700 rounded-xl mb-4">
          <p className="text-3xl mb-2">📊</p>
          <p className="font-sans text-slate-400 text-sm font-medium mb-1">No budget categories yet</p>
          <p className="font-sans text-slate-400 text-xs">Add your monthly expenses below — housing, food, transportation, etc.</p>
        </div>
      )}

      {/* column headers */}
      {budget.categories.length > 0 && (
        <div className="flex items-center gap-2.5 mb-2 ml-6">
          <span className="w-56 shrink-0 font-sans text-slate-400 text-xs uppercase tracking-wider">Category</span>
          <span className="flex-1 font-sans text-slate-400 text-xs uppercase tracking-wider">Description</span>
          <span className="w-28 shrink-0 font-sans text-slate-400 text-xs uppercase tracking-wider">Type</span>
          <span className="w-32 shrink-0 font-sans text-slate-400 text-xs uppercase tracking-wider">Monthly $</span>
          <span className="w-40 font-sans text-slate-400 text-xs uppercase tracking-wider">End Date</span>
        </div>
      )}

      <div className={`divide-y divide-slate-800 ${budget.categories.length > 0 ? 'mb-4' : ''}`}>
        {budget.categories.map((cat, idx) => (
          <div key={idx} className="py-2.5 first:pt-0">
            {/* Row: checkbox · category · name · type · amount · end date · delete */}
            <div className="flex items-center gap-2.5">
              {/* include toggle */}
              <input
                type="checkbox"
                checked={cat.include}
                onChange={e => updateCategory(idx, c => ({ ...c, include: e.target.checked }))}
                title={cat.include ? 'Click to exclude from projection' : 'Click to include in projection'}
                className="w-4 h-4 rounded border-slate-700 bg-slate-800 cursor-pointer accent-yellow-500 shrink-0"
              />

              {/* main category */}
              <select
                value={cat.main_category || 'Housing'}
                onChange={e => updateCategory(idx, c => ({ ...c, main_category: e.target.value as BudgetCategory['main_category'] }))}
                className={`w-56 shrink-0 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 font-sans text-sm cursor-pointer focus:border-gold-600 focus:outline-none ${cat.include ? 'text-white' : 'text-slate-300'}`}
              >
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              {/* name */}
              <input
                type="text"
                value={cat.category_name}
                onChange={e => updateCategory(idx, c => ({ ...c, category_name: e.target.value }))}
                placeholder="e.g. Mortgage Payment"
                className={`flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 font-sans text-sm placeholder-slate-600 focus:border-gold-600 focus:outline-none ${cat.include ? 'text-white' : 'text-slate-300'}`}
              />

              {/* type */}
              <select
                value={cat.category_type}
                onChange={e => updateCategory(idx, c => ({ ...c, category_type: e.target.value as BudgetCategory['category_type'] }))}
                className="w-28 shrink-0 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-sans text-sm cursor-pointer focus:border-gold-600 focus:outline-none"
              >
                {CATEGORY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>

              {/* amount */}
              <div className="relative w-32 shrink-0">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 font-sans text-sm">$</span>
                <input
                  type="number"
                  value={cat.monthly_amount}
                  min={0} step={50}
                  onFocus={handleFocus}
                  onChange={e => {
                    const v = e.target.valueAsNumber
                    updateCategory(idx, c => ({ ...c, monthly_amount: isNaN(v) ? 0 : v }))
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-6 pr-2 py-1.5 text-white font-sans text-sm focus:border-gold-600 focus:outline-none"
                />
              </div>

              {/* end date */}
              <input
                type="month"
                value={cat.end_month || ''}
                onChange={e => updateCategory(idx, c => ({ ...c, end_month: e.target.value || null }))}
                title="Optional: when does this expense end?"
                className="w-40 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-sans text-sm focus:border-gold-600 focus:outline-none"
              />

              {/* delete */}
              <button
                onClick={() => removeCategory(idx)}
                className="font-sans text-slate-400 hover:text-red-400 text-lg leading-none transition-colors shrink-0 px-1"
                title="Remove category"
              >×</button>
            </div>
          </div>
        ))}
      </div>

      {/* add button */}
      <button
        onClick={addCategory}
        className="w-full border border-slate-700 border-dashed rounded-xl px-4 py-4 font-sans text-slate-400 hover:text-gold-400 hover:border-gold-600 text-sm transition-colors duration-150 flex items-center justify-center gap-2 mb-5"
      >
        <span className="text-lg leading-none">+</span> Add Budget Category
      </button>

      {/* running total */}
      {budget.categories.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl px-5 py-4 mb-6 flex flex-wrap justify-between items-center gap-3">
          <div className="flex gap-6">
            <div>
              <p className="font-sans text-slate-300 text-xs mb-0.5">Fixed monthly</p>
              <p className="font-sans text-slate-200 text-sm font-semibold">${totalFixed.toLocaleString()}</p>
            </div>
            <div>
              <p className="font-sans text-slate-300 text-xs mb-0.5">Flexible monthly</p>
              <p className="font-sans text-slate-200 text-sm font-semibold">${totalFlexible.toLocaleString()}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-sans text-slate-300 text-xs mb-0.5">Total monthly spending</p>
            <p className="font-sans text-gold-400 text-lg font-bold">${totalMonthly.toLocaleString()}/mo</p>
            <p className="font-sans text-slate-400 text-xs">${(totalMonthly * 12).toLocaleString()}/year</p>
          </div>
        </div>
      )}

      {/* inflation & survivor settings */}
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
                  onChange({ ...budget, inflation_annual_percent: isNaN(v) ? 0 : toDecimal(v) })
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 pr-7 py-2 text-white font-sans text-sm focus:border-gold-600 focus:outline-none"
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
                  onChange({ ...budget, survivor_flexible_reduction_percent: isNaN(v) ? 0 : toDecimal(v) })
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 pr-7 py-2 text-white font-sans text-sm focus:border-gold-600 focus:outline-none"
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
              onChange={e => onChange({ ...budget, survivor_reduction_mode: e.target.value as BudgetSettings['survivor_reduction_mode'] })}
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
