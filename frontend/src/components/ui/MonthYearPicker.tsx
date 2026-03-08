/**
 * MonthYearPicker
 *
 * Replaces the native type="month" input with two styled dropdowns
 * (Month + Year) that match the app's dark theme.
 *
 * Props:
 *   value     — YYYY-MM string or null/undefined
 *   onChange  — called with YYYY-MM string or null (when cleared)
 *   minYear   — earliest selectable year (default: current year)
 *   maxYear   — latest selectable year (default: current year + 40)
 *   label     — optional label shown above the pickers
 *   required  — show asterisk
 *   clearable — show a clear button (default true)
 */

import { useMemo } from 'react'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface MonthYearPickerProps {
  value:      string | null | undefined   // YYYY-MM
  onChange:   (val: string | null) => void
  minYear?:   number
  maxYear?:   number
  label?:     string
  required?:  boolean
  clearable?: boolean
  className?: string
}

export default function MonthYearPicker({
  value,
  onChange,
  minYear,
  maxYear,
  label,
  required  = false,
  clearable = true,
  className = '',
}: MonthYearPickerProps) {
  const currentYear = new Date().getFullYear()
  const min = minYear ?? currentYear
  const max = maxYear ?? currentYear + 45

  const years = useMemo(() => {
    const arr: number[] = []
    for (let y = min; y <= max; y++) arr.push(y)
    return arr
  }, [min, max])

  // Parse current value
  const selectedYear  = value ? parseInt(value.split('-')[0]) : ''
  const selectedMonth = value ? value.split('-')[1] : ''

  const handleYear = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const yr = e.target.value
    if (!yr) { onChange(null); return }
    const mo = selectedMonth ? String(selectedMonth).padStart(2, '0') : '01'
    onChange(`${yr}-${mo}`)
  }

  const handleMonth = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mo = e.target.value
    if (!mo) { onChange(null); return }
    const yr = selectedYear || currentYear
    onChange(`${yr}-${mo}`)
  }

  const selectClass =
    'font-sans bg-slate-800 border border-violet-900/60 text-white text-sm rounded-lg px-3 py-2 ' +
    'focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 ' +
    'hover:border-violet-700 transition-colors appearance-none cursor-pointer'

  return (
    <div className={className}>
      {label && (
        <label className="block font-sans text-slate-300 text-xs font-medium uppercase tracking-wider mb-1.5">
          {label}{required && <span className="text-gold-400 ml-1">*</span>}
        </label>
      )}

      <div className="flex items-center gap-2">
        {/* Month dropdown */}
        <select
          value={selectedMonth || ''}
          onChange={handleMonth}
          className={selectClass + ' flex-1'}
        >
          <option value="">Month</option>
          {MONTHS.map((name, i) => (
            <option key={i} value={String(i + 1).padStart(2, '0')}>
              {name}
            </option>
          ))}
        </select>

        {/* Year dropdown */}
        <select
          value={selectedYear || ''}
          onChange={handleYear}
          className={selectClass + ' w-28'}
        >
          <option value="">Year</option>
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {/* Clear button */}
        {clearable && value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="font-sans text-slate-500 hover:text-red-400 text-sm px-1.5 transition-colors"
            title="Clear"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
