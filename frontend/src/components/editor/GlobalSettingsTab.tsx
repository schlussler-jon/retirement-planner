/**
 * GlobalSettingsTab
 *
 * Projection window (start year/month, end year) and residence state.
 * Month fields use paired year + month dropdowns for better UX than
 * a raw YYYY-MM text input.
 */

import type { GlobalSettings } from '@/types/scenario'
import { US_STATES }            from '@/types/scenario'

// States with implemented tax calculations or no state income tax
const SUPPORTED_STATE_CODES = [
  'AZ', 'CA', 'CO',                         // Implemented state taxes
  'AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY'  // No state income tax
]

interface Props {
  settings: GlobalSettings
  onChange: (s: GlobalSettings) => void
}

const START_YEARS  = Array.from({ length: 11 }, (_, i) => 2024 + i) // 2024–2034
const END_YEARS    = Array.from({ length: 76 }, (_, i) => 2024 + i) // 2024–2099
const MONTHS       = Array.from({ length: 12 }, (_, i) => i + 1)
const MONTH_NAMES  = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December']

export default function GlobalSettingsTab({ settings, onChange }: Props) {
  // parse YYYY-MM
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
        Define the projection window and your state of residence for tax calculations.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Start Year */}
        <div>
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Start Year</label>
          <select value={startYear} onChange={e => setStartYear(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer">
            {START_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Start Month */}
        <div>
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Start Month</label>
          <select value={startMonth} onChange={e => setStartMonth(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer">
            {MONTHS.map(m => <option key={m} value={m}>{MONTH_NAMES[m-1]}</option>)}
          </select>
        </div>

        {/* End Year */}
        <div>
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">End Year</label>
          <select value={settings.projection_end_year} onChange={e => onChange({ ...settings, projection_end_year: Number(e.target.value) })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer">
            {END_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Residence State */}
        <div className="sm:col-span-3 max-w-xs">
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Residence State</label>
          <select value={settings.residence_state} onChange={e => onChange({ ...settings, residence_state: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer">
{US_STATES.filter(s => SUPPORTED_STATE_CODES.includes(s.code)).map(s => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}

          </select>
          <p className="font-sans text-slate-400 text-xs mt-1">Showing states with tax support (AZ, CA, CO) and no-income-tax states.</p>
        </div>
      </div>
    </div>
  )
}
