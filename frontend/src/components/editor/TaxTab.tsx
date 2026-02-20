/**
 * TaxTab
 *
 * Filing status, tax-year ruleset, and an optional standard-deduction
 * override.  State tax is handled automatically via the residence state
 * chosen in Settings.
 */

import type { TaxSettings } from '@/types/scenario'
import { FILING_STATUSES }  from '@/types/scenario'

interface Props {
  tax: TaxSettings
  onChange: (tax: TaxSettings) => void
}

const TAX_YEARS = Array.from({ length: 11 }, (_, i) => 2020 + i) // 2020–2030

export default function TaxTab({ tax, onChange }: Props) {
  return (
    <div>
      <p className="font-sans text-slate-300 text-xs mb-5">
        Configure federal tax settings. State tax is determined automatically by your residence state in Settings.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* filing status */}
        <div>
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
            Filing Status <span className="text-danger">*</span>
          </label>
          <select value={tax.filing_status}
            onChange={e => onChange({ ...tax, filing_status: e.target.value as TaxSettings['filing_status'] })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer">
            {FILING_STATUSES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>

        {/* tax year ruleset */}
        <div>
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
            Tax Year Rules
          </label>
          <select value={tax.tax_year_ruleset}
            onChange={e => onChange({ ...tax, tax_year_ruleset: Number(e.target.value) })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer">
            {TAX_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <p className="font-sans text-slate-400 text-xs mt-1">Which year's tax brackets to use.</p>
        </div>

        {/* standard deduction override */}
        <div>
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
            Std. Deduction Override ($)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 font-sans text-sm">$</span>
            <input type="number" value={tax.standard_deduction_override ?? ''} min={0} step={1000}
              onChange={e => {
                const raw = e.target.value
                if (raw === '') {
                  onChange({ ...tax, standard_deduction_override: null })
                } else {
                  const v = e.target.valueAsNumber
                  onChange({ ...tax, standard_deduction_override: isNaN(v) ? null : v })
                }
              }}
              placeholder="Use default"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white font-sans text-sm placeholder-slate-600" />
          </div>
          <p className="font-sans text-slate-400 text-xs mt-1">Leave blank for the standard amount.</p>
        </div>
      </div>
    </div>
  )
}
