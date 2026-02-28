/**
 * TaxTab
 *
 * Filing status only. Tax calculations always use 2025 federal rules
 * with the standard deduction for the selected filing status.
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

      <div className="max-w-xs">
        <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
          Filing Status <span className="text-red-400">*</span>
        </label>
        <select
          value={tax.filing_status}
          onChange={e => onChange({ ...tax, filing_status: e.target.value as TaxSettings['filing_status'] })}
          className="w-full bg-slate-800 border border-violet-800 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer focus:border-gold-600 focus:outline-none"
        >
          {FILING_STATUSES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <p className="font-sans text-slate-400 text-xs mt-1">How you file your federal tax return</p>
      </div>
    </div>
  )
}
