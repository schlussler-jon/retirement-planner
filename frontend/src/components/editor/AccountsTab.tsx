/**
 * AccountsTab
 *
 * CRUD for InvestmentAccount records.  Return-rate is displayed as a
 * whole-number percent and converted to/from a decimal for the backend.
 * Dollar fields show a "$" prefix glyph inside the input.
 */

import type { InvestmentAccount } from '@/types/scenario'
import { TAX_BUCKETS }            from '@/types/scenario'

interface Props {
  accounts: InvestmentAccount[]
  onChange: (accounts: InvestmentAccount[]) => void
}

const toDisplay = (d: number) => Math.round(d * 10000) / 100
const toDecimal = (p: number) => p / 100

function updateAt<T>(arr: T[], idx: number, fn: (item: T) => T): T[] {
  return arr.map((item, i) => (i === idx ? fn(item) : item))
}

// Helper to select all text on focus (replaces leading zero when typing)
const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select()

export default function AccountsTab({ accounts, onChange }: Props) {
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
    }])
  }

  const removeAccount = (idx: number) => onChange(accounts.filter((_, i) => i !== idx))

  const update = (idx: number, fn: (a: InvestmentAccount) => InvestmentAccount) =>
    onChange(updateAt(accounts, idx, fn))

  return (
    <div>
      <p className="font-sans text-slate-500 text-xs mb-5">
        Add retirement and investment accounts. Withdrawals count as income; tax treatment is determined by the account type.
      </p>

      {accounts.length === 0 && (
        <p className="font-sans text-slate-600 text-sm text-center py-6">No accounts added yet.</p>
      )}

      <div className={`divide-y divide-slate-800 ${accounts.length > 0 ? 'mb-4' : ''}`}>
        {accounts.map((acct, idx) => (
          <div key={idx} className="py-4 first:pt-0">
            {/* header */}
            <div className="flex items-center justify-between mb-3">
              <span className="font-sans text-slate-300 text-sm font-medium">
                {acct.name || `Account ${idx + 1}`}
                <span className="text-slate-600 ml-2">
                  {TAX_BUCKETS.find(b => b.value === acct.tax_bucket)?.label}
                </span>
              </span>
              <button onClick={() => removeAccount(idx)}
                className="font-sans text-slate-600 hover:text-danger text-lg leading-none transition-colors" title="Remove account">×</button>
            </div>

            {/* row 1: name · tax bucket · ID */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Account Name <span className="text-danger">*</span>
                </label>
                <input type="text" value={acct.name}
                  onChange={e => update(idx, a => ({ ...a, name: e.target.value }))}
                  placeholder="e.g. 401k"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm placeholder-slate-600" />
              </div>
              <div>
                <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Tax Bucket <span className="text-danger">*</span>
                </label>
                <select value={acct.tax_bucket}
                  onChange={e => update(idx, a => ({ ...a, tax_bucket: e.target.value as InvestmentAccount['tax_bucket'] }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer">
                  {TAX_BUCKETS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Account ID</label>
                <input type="text" value={acct.account_id}
                  onChange={e => update(idx, a => ({ ...a, account_id: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm font-mono text-slate-400" />
              </div>
            </div>

            {/* row 2: balance · return rate */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Starting Balance ($) <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-sans text-sm">$</span>
                  <input type="number" value={acct.starting_balance} min={0} step={1000}
                    onFocus={handleFocus}
                    onChange={e => {
                      const v = e.target.valueAsNumber
                      update(idx, a => ({ ...a, starting_balance: isNaN(v) ? 0 : v }))
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white font-sans text-sm" />
                </div>
              </div>
              <div>
                <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Annual Return Rate (%)
                </label>
                <div className="relative">
                  <input type="number" value={toDisplay(acct.annual_return_rate)} min={-50} max={50} step={0.5}
                    onFocus={handleFocus}
                    onChange={e => {
                      const v = e.target.valueAsNumber
                      update(idx, a => ({ ...a, annual_return_rate: isNaN(v) ? 0 : toDecimal(v) }))
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 pr-7 py-2 text-white font-sans text-sm" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-sans text-sm">%</span>
                </div>
                <p className="font-sans text-slate-600 text-xs mt-1">e.g. 6 for 6 % annual growth</p>
              </div>
            </div>

            {/* row 3: contribution · withdrawal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Monthly Contribution ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-sans text-sm">$</span>
                  <input type="number" value={acct.monthly_contribution} min={0} step={100}
                    onFocus={handleFocus}
                    onChange={e => {
                      const v = e.target.valueAsNumber
                      update(idx, a => ({ ...a, monthly_contribution: isNaN(v) ? 0 : v }))
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white font-sans text-sm" />
                </div>
              </div>
              <div>
                <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Monthly Withdrawal ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-sans text-sm">$</span>
                  <input type="number" value={acct.monthly_withdrawal} min={0} step={100}
                    onFocus={handleFocus}
                    onChange={e => {
                      const v = e.target.valueAsNumber
                      update(idx, a => ({ ...a, monthly_withdrawal: isNaN(v) ? 0 : v }))
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white font-sans text-sm" />
                </div>
                <p className="font-sans text-slate-600 text-xs mt-1">Withdrawals are taxable income (except Roth).</p>
              </div>
            </div>

            {/* row 4: contribution dates · withdrawal dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Contribution Start
                </label>
                <input type="month" value={acct.contribution_start_month || ''}
                  onChange={e => update(idx, a => ({ ...a, contribution_start_month: e.target.value || null }))}
                  placeholder="YYYY-MM"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm" />
                <p className="font-sans text-slate-600 text-xs mt-1">When to start</p>
              </div>
              <div>
                <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Contribution End
                </label>
                <input type="month" value={acct.contribution_end_month || ''}
                  onChange={e => update(idx, a => ({ ...a, contribution_end_month: e.target.value || null }))}
                  placeholder="YYYY-MM"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm" />
                <p className="font-sans text-slate-600 text-xs mt-1">When to stop</p>
              </div>
              <div>
                <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Withdrawal Start
                </label>
                <input type="month" value={acct.withdrawal_start_month || ''}
                  onChange={e => update(idx, a => ({ ...a, withdrawal_start_month: e.target.value || null }))}
                  placeholder="YYYY-MM"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm" />
                <p className="font-sans text-slate-600 text-xs mt-1">When to start</p>
              </div>
              <div>
                <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Withdrawal End
                </label>
                <input type="month" value={acct.withdrawal_end_month || ''}
                  onChange={e => update(idx, a => ({ ...a, withdrawal_end_month: e.target.value || null }))}
                  placeholder="YYYY-MM"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm" />
                <p className="font-sans text-slate-600 text-xs mt-1">When to stop</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* add button */}
      <button onClick={addAccount}
        className="w-full border border-slate-700 border-dashed rounded-lg px-4 py-3 font-sans text-slate-500 hover:text-gold-500 hover:border-gold-600 text-sm transition-colors duration-150">
        + Add Account
      </button>
    </div>
  )
}
