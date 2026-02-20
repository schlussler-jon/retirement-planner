/**
 * AccountsTab
 *
 * CRUD for InvestmentAccount records.
 * Internal account_id is hidden — auto-generated transparently.
 * Date fields and advanced options collapsed by default.
 */

import { useEffect, useRef, useState } from 'react'
import type { InvestmentAccount } from '@/types/scenario'
import { TAX_BUCKETS } from '@/types/scenario'

interface Props {
  accounts: InvestmentAccount[]
  onChange: (accounts: InvestmentAccount[]) => void
  autoAdd?: boolean
  onAutoAddDone?: () => void
}

const toDisplay = (d: number) => Math.round(d * 10000) / 100
const toDecimal = (p: number) => p / 100

function updateAt<T>(arr: T[], idx: number, fn: (item: T) => T): T[] {
  return arr.map((item, i) => (i === idx ? fn(item) : item))
}

const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select()

const TAX_BUCKET_HELP: Record<string, string> = {
  tax_deferred: 'Traditional 401k, 457b, IRA — taxed on withdrawal',
  roth:         'Roth 401k, Roth IRA — grows tax-free, no tax on withdrawal',
  taxable:      'Brokerage, savings — taxed on dividends and gains',
}

function AccountCard({
  acct,
  idx,
  onUpdate,
  onRemove,
}: {
  acct: InvestmentAccount
  idx: number
  onUpdate: (fn: (a: InvestmentAccount) => InvestmentAccount) => void
  onRemove: () => void
}) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <div className="py-5 first:pt-0">
      {/* header */}
      <div className="flex items-center justify-between mb-4">
        <span className="font-sans text-white text-sm font-semibold">
          {acct.name || `Account ${idx + 1}`}
          <span className="text-slate-300 font-normal ml-2">
            {TAX_BUCKETS.find(b => b.value === acct.tax_bucket)?.label}
          </span>
        </span>
        <button
          onClick={onRemove}
          className="font-sans text-slate-400 hover:text-red-400 text-sm transition-colors px-2 py-1 rounded hover:bg-red-400/10"
        >
          Remove
        </button>
      </div>

      {/* row 1: name · tax bucket */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
            Account Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={acct.name}
            onChange={e => onUpdate(a => ({ ...a, name: e.target.value }))}
            placeholder="e.g. Jon's 401k"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm placeholder-slate-600 focus:border-gold-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
            Account Type <span className="text-red-400">*</span>
          </label>
          <select
            value={acct.tax_bucket}
            onChange={e => onUpdate(a => ({ ...a, tax_bucket: e.target.value as InvestmentAccount['tax_bucket'] }))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer focus:border-gold-600 focus:outline-none"
          >
            {TAX_BUCKETS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
          <p className="font-sans text-slate-400 text-xs mt-1">
            {TAX_BUCKET_HELP[acct.tax_bucket]}
          </p>
        </div>
      </div>

      {/* row 2: balance · return rate */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
            Current Balance <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 font-sans text-sm">$</span>
            <input
              type="number"
              value={acct.starting_balance}
              min={0} step={1000}
              onFocus={handleFocus}
              onChange={e => {
                const v = e.target.valueAsNumber
                onUpdate(a => ({ ...a, starting_balance: isNaN(v) ? 0 : v }))
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white font-sans text-sm focus:border-gold-600 focus:outline-none"
            />
          </div>
          <p className="font-sans text-slate-400 text-xs mt-1">Balance at the start of the projection</p>
        </div>

        <div>
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
            Expected Annual Return
          </label>
          <div className="relative">
            <input
              type="number"
              value={toDisplay(acct.annual_return_rate)}
              min={-50} max={50} step={0.5}
              onFocus={handleFocus}
              onChange={e => {
                const v = e.target.valueAsNumber
                onUpdate(a => ({ ...a, annual_return_rate: isNaN(v) ? 0 : toDecimal(v) }))
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 pr-7 py-2 text-white font-sans text-sm focus:border-gold-600 focus:outline-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 font-sans text-sm">%</span>
          </div>
          <p className="font-sans text-slate-400 text-xs mt-1">6–7% is a common estimate for a balanced portfolio</p>
        </div>
      </div>

      {/* row 3: contribution · withdrawal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
        <div>
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
            Monthly Contribution
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 font-sans text-sm">$</span>
            <input
              type="number"
              value={acct.monthly_contribution}
              min={0} step={100}
              onFocus={handleFocus}
              onChange={e => {
                const v = e.target.valueAsNumber
                onUpdate(a => ({ ...a, monthly_contribution: isNaN(v) ? 0 : v }))
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white font-sans text-sm focus:border-gold-600 focus:outline-none"
            />
          </div>
          <p className="font-sans text-slate-400 text-xs mt-1">How much you add each month</p>
        </div>

        <div>
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
            Monthly Withdrawal
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 font-sans text-sm">$</span>
            <input
              type="number"
              value={acct.monthly_withdrawal}
              min={0} step={100}
              onFocus={handleFocus}
              onChange={e => {
                const v = e.target.valueAsNumber
                onUpdate(a => ({ ...a, monthly_withdrawal: isNaN(v) ? 0 : v }))
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white font-sans text-sm focus:border-gold-600 focus:outline-none"
            />
          </div>
          <p className="font-sans text-slate-400 text-xs mt-1">How much you take out each month in retirement</p>
        </div>
      </div>

      {/* receives surplus */}
      <div className="flex items-start gap-3 mb-3 p-3 bg-slate-800/40 rounded-lg">
        <input
          type="checkbox"
          id={`surplus-${idx}`}
          checked={acct.receives_surplus || false}
          onChange={e => onUpdate(a => ({ ...a, receives_surplus: e.target.checked }))}
          className="w-4 h-4 mt-0.5 bg-slate-800 border-slate-700 rounded cursor-pointer accent-yellow-500"
        />
        <label htmlFor={`surplus-${idx}`} className="cursor-pointer">
          <span className="font-sans text-white text-sm font-medium">Receives monthly surplus / covers deficit</span>
          <p className="font-sans text-slate-300 text-xs mt-0.5">
            Any leftover money each month goes into this account; any shortfall is drawn from it.
            Typically your primary savings account.
          </p>
        </label>
      </div>

      {/* advanced toggle */}
      <button
        onClick={() => setShowAdvanced(v => !v)}
        className="font-sans text-slate-300 hover:text-slate-300 text-xs transition-colors flex items-center gap-1 mb-3"
      >
        <span>{showAdvanced ? '▾' : '▸'}</span>
        {showAdvanced ? 'Hide' : 'Show'} contribution & withdrawal date ranges
      </button>

      {showAdvanced && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-800/40 rounded-lg p-4">
          <div>
            <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Contribution Start
            </label>
            <input type="month" value={acct.contribution_start_month || ''}
              onChange={e => onUpdate(a => ({ ...a, contribution_start_month: e.target.value || null }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm focus:border-gold-600 focus:outline-none" />
            <p className="font-sans text-slate-400 text-xs mt-1">When to start contributing</p>
          </div>
          <div>
            <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Contribution End
            </label>
            <input type="month" value={acct.contribution_end_month || ''}
              onChange={e => onUpdate(a => ({ ...a, contribution_end_month: e.target.value || null }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm focus:border-gold-600 focus:outline-none" />
            <p className="font-sans text-slate-400 text-xs mt-1">When to stop contributing</p>
          </div>
          <div>
            <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Withdrawal Start
            </label>
            <input type="month" value={acct.withdrawal_start_month || ''}
              onChange={e => onUpdate(a => ({ ...a, withdrawal_start_month: e.target.value || null }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm focus:border-gold-600 focus:outline-none" />
            <p className="font-sans text-slate-400 text-xs mt-1">When to start withdrawing</p>
          </div>
          <div>
            <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Withdrawal End
            </label>
            <input type="month" value={acct.withdrawal_end_month || ''}
              onChange={e => onUpdate(a => ({ ...a, withdrawal_end_month: e.target.value || null }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm focus:border-gold-600 focus:outline-none" />
            <p className="font-sans text-slate-400 text-xs mt-1">When to stop withdrawing</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AccountsTab({ accounts, onChange, autoAdd, onAutoAddDone }: Props) {
  const addAccount = () => {
    onChange([...accounts, {
      account_id: `account_${accounts.length + 1}`,
      name: '',
      tax_bucket: 'tax_deferred',
      starting_balance: 0,
      annual_return_rate: 0.06,
      monthly_contribution: 0,
      contribution_start_month: null,
      contribution_end_month: null,
      monthly_withdrawal: 0,
      withdrawal_start_month: null,
      withdrawal_end_month: null,
      receives_surplus: false,
    }])
  }

  const removeAccount = (idx: number) => onChange(accounts.filter((_, i) => i !== idx))
  const update = (idx: number, fn: (a: InvestmentAccount) => InvestmentAccount) =>
    onChange(updateAt(accounts, idx, fn))

  const didAutoAdd = useRef(false)
  useEffect(() => {
    if (autoAdd && !didAutoAdd.current) {
      didAutoAdd.current = true
      addAccount()
      onAutoAddDone?.()
    }
    if (!autoAdd) didAutoAdd.current = false
  }, [autoAdd])

  return (
    <div>
      <p className="font-sans text-slate-400 text-sm mb-5">
        Add your investment and savings accounts. The projection will track their growth, contributions,
        and withdrawals over time.
      </p>

      {accounts.length === 0 && (
        <div className="text-center py-8 border border-dashed border-slate-700 rounded-xl mb-4">
          <p className="text-3xl mb-2">🏦</p>
          <p className="font-sans text-slate-400 text-sm font-medium mb-1">No accounts added yet</p>
          <p className="font-sans text-slate-400 text-xs">Add your 401k, IRA, Roth, or other savings accounts below</p>
        </div>
      )}

      <div className={`divide-y divide-slate-800 ${accounts.length > 0 ? 'mb-4' : ''}`}>
        {accounts.map((acct, idx) => (
          <AccountCard
            key={idx}
            acct={acct}
            idx={idx}
            onUpdate={fn => update(idx, fn)}
            onRemove={() => removeAccount(idx)}
          />
        ))}
      </div>

      <button
        onClick={addAccount}
        className="w-full border border-slate-700 border-dashed rounded-xl px-4 py-4 font-sans text-slate-400 hover:text-gold-400 hover:border-gold-600 text-sm transition-colors duration-150 flex items-center justify-center gap-2"
      >
        <span className="text-lg leading-none">+</span> Add Account
      </button>
    </div>
  )
}
