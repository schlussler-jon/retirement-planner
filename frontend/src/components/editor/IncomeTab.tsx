/**
 * IncomeTab
 *
 * CRUD for IncomeStream records.  Percent fields (COLA) are displayed
 * as whole-number percentages and converted to/from decimals for the
 * backend.  The owner dropdown is populated from the People tab.
 */

import type { IncomeStream, Person } from '@/types/scenario'
import { INCOME_STREAM_TYPES }       from '@/types/scenario'

interface Props {
  streams: IncomeStream[]
  people: Person[]
  onChange: (streams: IncomeStream[]) => void
}

const MONTHS      = Array.from({ length: 12 }, (_, i) => i + 1)
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const START_YEARS = Array.from({ length: 11 }, (_, i) => 2024 + i)

const toDisplay = (d: number) => Math.round(d * 10000) / 100  // 0.025 → 2.5
const toDecimal = (p: number) => p / 100                        // 2.5 → 0.025

function updateAt<T>(arr: T[], idx: number, fn: (item: T) => T): T[] {
  return arr.map((item, i) => (i === idx ? fn(item) : item))
}

export default function IncomeTab({ streams, people, onChange }: Props) {
  const addStream = () => {
    onChange([...streams, {
      stream_id: `stream_${streams.length + 1}`,
      type: 'pension',
      owner_person_id: people.length > 0 ? people[0].person_id : '',
      start_month: '2026-01',
      monthly_amount_at_start: 0,
      cola_percent_annual: 0,
      cola_month: 1,
    }])
  }

  const removeStream = (idx: number) => onChange(streams.filter((_, i) => i !== idx))

  const update = (idx: number, fn: (s: IncomeStream) => IncomeStream) =>
    onChange(updateAt(streams, idx, fn))

  return (
    <div>
      <p className="font-sans text-slate-500 text-xs mb-5">
        Add recurring income sources. Each stream belongs to a person and may include an annual COLA adjustment.
      </p>

      {people.length === 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg px-4 py-3 mb-4">
          <p className="font-sans text-warning text-xs">
            Add at least one person in the <strong>People</strong> tab before adding income streams.
          </p>
        </div>
      )}

      {streams.length === 0 && (
        <p className="font-sans text-slate-600 text-sm text-center py-6">No income streams added yet.</p>
      )}

      <div className={`divide-y divide-slate-800 ${streams.length > 0 ? 'mb-4' : ''}`}>
        {streams.map((stream, idx) => {
          const parts  = stream.start_month.split('-')
          const sYear  = parseInt(parts[0], 10) || 2026
          const sMonth = parseInt(parts[1], 10) || 1
          const owner  = people.find(p => p.person_id === stream.owner_person_id)

          return (
            <div key={idx} className="py-4 first:pt-0">
              {/* header */}
              <div className="flex items-center justify-between mb-3">
                <span className="font-sans text-slate-300 text-sm font-medium">
                  {INCOME_STREAM_TYPES.find(t => t.value === stream.type)?.label ?? stream.type}
                  {owner && <span className="text-slate-600 ml-2">— {owner.name}</span>}
                </span>
                <button onClick={() => removeStream(idx)}
                  className="font-sans text-slate-600 hover:text-danger text-lg leading-none transition-colors" title="Remove stream">×</button>
              </div>

              {/* row 1: type · owner · ID */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Type <span className="text-danger">*</span>
                  </label>
                  <select value={stream.type}
                    onChange={e => update(idx, s => ({ ...s, type: e.target.value as IncomeStream['type'] }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer">
                    {INCOME_STREAM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Owner <span className="text-danger">*</span>
                  </label>
                  <select value={stream.owner_person_id} disabled={people.length === 0}
                    onChange={e => update(idx, s => ({ ...s, owner_person_id: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer disabled:opacity-50">
                    {people.length === 0 && <option value="">— no people —</option>}
                    {people.map(p => <option key={p.person_id} value={p.person_id}>{p.name || p.person_id}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Stream ID</label>
                  <input type="text" value={stream.stream_id}
                    onChange={e => update(idx, s => ({ ...s, stream_id: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm font-mono text-slate-400" />
                </div>
              </div>

              {/* row 2: start year · start month · monthly amount */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Start Year</label>
                  <select value={sYear}
                    onChange={e => {
                      const y = Number(e.target.value)
                      update(idx, s => ({ ...s, start_month: `${y}-${String(sMonth).padStart(2,'0')}` }))
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer">
                    {START_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Start Month</label>
                  <select value={sMonth}
                    onChange={e => {
                      const m = Number(e.target.value)
                      update(idx, s => ({ ...s, start_month: `${sYear}-${String(m).padStart(2,'0')}` }))
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer">
                    {MONTHS.map(m => <option key={m} value={m}>{MONTH_NAMES[m-1]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Monthly Amount ($) <span className="text-danger">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-sans text-sm">$</span>
                    <input type="number" value={stream.monthly_amount_at_start} min={0} step={100}
                      onChange={e => {
                        const v = e.target.valueAsNumber
                        update(idx, s => ({ ...s, monthly_amount_at_start: isNaN(v) ? 0 : v }))
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white font-sans text-sm" />
                  </div>
                </div>
              </div>

              {/* row 3: COLA % · COLA month */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Annual COLA (%)
                  </label>
                  <div className="relative">
                    <input type="number" value={toDisplay(stream.cola_percent_annual)} min={0} max={50} step={0.1}
                      onChange={e => {
                        const v = e.target.valueAsNumber
                        update(idx, s => ({ ...s, cola_percent_annual: isNaN(v) ? 0 : toDecimal(v) }))
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 pr-7 py-2 text-white font-sans text-sm" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-sans text-sm">%</span>
                  </div>
                  <p className="font-sans text-slate-600 text-xs mt-1">e.g. 2.5 for a 2.5 % annual increase</p>
                </div>
                <div>
                  <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                    COLA Applied In
                  </label>
                  <select value={stream.cola_month}
                    onChange={e => update(idx, s => ({ ...s, cola_month: Number(e.target.value) }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer">
                    {MONTHS.map(m => <option key={m} value={m}>{MONTH_NAMES[m-1]}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* add button */}
      <button onClick={addStream} disabled={people.length === 0}
        className="w-full border border-slate-700 border-dashed rounded-lg px-4 py-3 font-sans text-slate-500 hover:text-gold-500 hover:border-gold-600 disabled:opacity-40 disabled:hover:text-slate-500 disabled:hover:border-slate-700 text-sm transition-colors duration-150">
        + Add Income Stream
      </button>
    </div>
  )
}
