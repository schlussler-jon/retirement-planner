/**
 * TaxTab
 *
 * Filing status and an optional standard-deduction override.
 * Tax calculations always use 2025 federal rules.
 * State tax is handled automatically via the residence state in Settings.
 */

import type { TaxSettings } from '@/types/scenario'
import { FILING_STATUSES }  from '@/types/scenario'

interface Props {
  tax: TaxSettings
  onChange: (tax: TaxSettings) => void
}

export default function TaxTab({ tax, onChange }: Props) {
  return (
    <div>
      <p className="font-sans text-slate-300 text-xs mb-5">
        Configure federal tax settings. Calculations use 2025 federal tax brackets and standard deductions.
        State tax is determined automatically by your residence state in Settings.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Filing status */}
        <div>
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
            Filing Status <span className="text-red-400">*</span>
          </label>
          <select
            value={tax.filing_status}
            onChange={e => onChange({ ...tax, filing_status: e.target.value as TaxSettings['filing_status'] })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer focus:border-gold-600 focus:outline-none"
          >
            {FILING_STATUSES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <p className="font-sans text-slate-400 text-xs mt-1">How you file your federal tax return</p>
        </div>

        {/* Standard deduction override */}
        <div>
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
            Standard Deduction Override
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 font-sans text-sm">$</span>
            <input
              type="number"
              value={tax.standard_deduction_override ?? ''}
              min={0} step={1000}
              onChange={e => {
                const raw = e.target.value
                if (raw === '') {
                  onChange({ ...tax, standard_deduction_override: null })
                } else {
                  const v = e.target.valueAsNumber
                  onChange({ ...tax, standard_deduction_override: isNaN(v) ? null : v })
                }
              }}
              placeholder="Use 2025 default"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white font-sans text-sm placeholder-slate-600 focus:border-gold-600 focus:outline-none"
            />
          </div>
          <p className="font-sans text-slate-400 text-xs mt-1">Leave blank to use the standard 2025 amount for your filing status</p>
        </div>
      </div>
    </div>
  )
}
