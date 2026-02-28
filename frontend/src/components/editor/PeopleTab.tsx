/**
 * PeopleTab
 *
 * CRUD for Person records.
 * Internal person_id is hidden from users — it's auto-generated and
 * managed transparently.
 */

import { useEffect, useRef } from 'react'
import type { Person } from '@/types/scenario'

interface Props {
  people: Person[]
  onChange: (people: Person[]) => void
  autoAdd?: boolean
  onAutoAddDone?: () => void
}

function updateAt<T>(arr: T[], idx: number, fn: (item: T) => T): T[] {
  return arr.map((item, i) => (i === idx ? fn(item) : item))
}

const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'working_full_time', label: 'Working Full-Time' },
  { value: 'working_part_time', label: 'Working Part-Time' },
  { value: 'self_employed',     label: 'Self-Employed' },
  { value: 'retired',           label: 'Retired' },
  { value: 'not_working',       label: 'Not Working' },
]

const isWorking = (status?: string | null) =>
  status === 'working_full_time' || status === 'working_part_time' || status === 'self_employed'

const isRetired = (status?: string | null) => status === 'retired'

const ssStatusLabel = (date?: string | null): string => {
  if (!date) return ''
  const [year, month] = date.split('-').map(Number)
  const now = new Date()
  const ssDate = new Date(year, month - 1)
  if (ssDate <= now) return 'Already receiving'
  const months = (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth())
  const years = Math.floor(months / 12)
  const rem   = months % 12
  if (years === 0) return `Starting in ${rem} month${rem !== 1 ? 's' : ''}`
  if (rem === 0)   return `Starting in ${years} year${years !== 1 ? 's' : ''}`
  return `Starting in ${years}y ${rem}m`
}

export default function PeopleTab({ people, onChange, autoAdd, onAutoAddDone }: Props) {
  const addPerson = () => {
    const nextNum = people.length + 1
    onChange([...people, {
      person_id: `person_${nextNum}`,
      name: '',
      birth_date: '1965-01-01',
      life_expectancy_years: 90,
      employment_status: null,
      planned_retirement_date: null,
      social_security_start_date: null,
    }])
  }

  const removePerson = (idx: number) => onChange(people.filter((_, i) => i !== idx))
  const update = (idx: number, fn: (p: Person) => Person) => onChange(updateAt(people, idx, fn))

  const didAutoAdd = useRef(false)
  useEffect(() => {
    if (autoAdd && !didAutoAdd.current) {
      didAutoAdd.current = true
      addPerson()
      onAutoAddDone?.()
    }
    if (!autoAdd) didAutoAdd.current = false
  }, [autoAdd])

  return (
    <div>
      <p className="font-sans text-slate-400 text-sm mb-5">
        Add everyone included in this retirement plan — yourself, and your spouse or partner if applicable.
        Income streams will be linked to each person.
      </p>

      {people.length === 0 && (
        <div className="text-center py-8 border border-dashed border-violet-800 rounded-xl mb-4">
          <p className="text-3xl mb-2">👤</p>
          <p className="font-sans text-slate-400 text-sm font-medium mb-1">No people added yet</p>
          <p className="font-sans text-slate-400 text-xs">Click "Add Person" below to get started</p>
        </div>
      )}

      <div className={`space-y-3 ${people.length > 0 ? 'mb-4' : ''}`}>
        {people.map((person, idx) => (
          <div key={idx} className="bg-slate-800/50 border border-violet-800/50 rounded-xl p-4 overflow-hidden">

            <div className="flex items-center justify-between mb-4">
              <span className="font-sans text-white text-sm font-semibold">
                {person.name || `Person ${idx + 1}`}
              </span>
              <button
                onClick={() => removePerson(idx)}
                className="font-sans text-slate-400 hover:text-red-400 text-sm transition-colors px-2 py-1 rounded hover:bg-red-400/10"
              >
                Remove
              </button>
            </div>

            {/* Row 1: Name, DOB, Life Expectancy */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={person.name}
                  onChange={e => update(idx, p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Jon"
                  className="w-full min-w-0 bg-slate-800 border border-violet-800 rounded-lg px-3 py-2 text-white font-sans text-sm placeholder-slate-600 focus:border-gold-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Date of Birth <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={person.birth_date}
                  onChange={e => update(idx, p => ({ ...p, birth_date: e.target.value }))}
                  className="w-full min-w-0 bg-slate-800 border border-violet-800 rounded-lg px-3 py-2 text-white font-sans text-sm focus:border-gold-600 focus:outline-none"
                />
                <p className="font-sans text-slate-400 text-xs mt-1">Used to calculate retirement age</p>
              </div>

              <div>
                <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Life Expectancy
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={person.life_expectancy_years ?? ''}
                    min={50} max={120}
                    onChange={e => {
                      const v = e.target.valueAsNumber
                      update(idx, p => ({ ...p, life_expectancy_years: isNaN(v) ? null : v }))
                    }}
                    placeholder="e.g. 90"
                    className="w-full min-w-0 bg-slate-800 border border-violet-800 rounded-lg px-3 pr-14 py-2 text-white font-sans text-sm placeholder-slate-600 focus:border-gold-600 focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 font-sans text-xs">years</span>
                </div>
                <p className="font-sans text-slate-400 text-xs mt-1">How long to run the projection</p>
              </div>
            </div>

            {/* Row 2: Employment Status + Planned Retirement Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-violet-900/50">
              <div>
                <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Employment Status
                </label>
                <select
                  value={person.employment_status ?? ''}
                  onChange={e => update(idx, p => ({
                    ...p,
                    employment_status: e.target.value || null,
                    planned_retirement_date: isWorking(e.target.value) ? p.planned_retirement_date : null,
                  }))}
                  className="w-full bg-slate-800 border border-violet-800 rounded-lg px-3 py-2 text-white font-sans text-sm focus:border-gold-600 focus:outline-none"
                >
                  <option value="">Select status…</option>
                  {EMPLOYMENT_STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="font-sans text-slate-400 text-xs mt-1">Used in AI analysis and scenario summary</p>
              </div>

              {/* Planned retirement date — only for working people */}
              {isWorking(person.employment_status) && (
                <div>
                  <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Planned Retirement Date
                  </label>
                  <input
                    type="month"
                    value={person.planned_retirement_date ?? ''}
                    onChange={e => update(idx, p => ({
                      ...p,
                      planned_retirement_date: e.target.value || null,
                    }))}
                    className="w-full min-w-0 bg-slate-800 border border-violet-800 rounded-lg px-3 py-2 text-white font-sans text-sm focus:border-gold-600 focus:outline-none"
                  />
                  <p className="font-sans text-slate-400 text-xs mt-1">When do you plan to stop working?</p>
                </div>
              )}
            </div>

            {/* Row 3: Social Security — show for retired or working with planned retirement */}
            {(isRetired(person.employment_status) || (isWorking(person.employment_status) && person.planned_retirement_date)) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 mt-4 border-t border-violet-900/50">
                <div>
                  <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Social Security Start Date
                  </label>
                  <input
                    type="month"
                    value={person.social_security_start_date ?? ''}
                    onChange={e => update(idx, p => ({
                      ...p,
                      social_security_start_date: e.target.value || null,
                    }))}
                    className="w-full min-w-0 bg-slate-800 border border-violet-800 rounded-lg px-3 py-2 text-white font-sans text-sm focus:border-gold-600 focus:outline-none"
                  />
                  {person.social_security_start_date && (
                    <p className="font-sans text-gold-500 text-xs mt-1">
                      {ssStatusLabel(person.social_security_start_date)}
                    </p>
                  )}
                  {!person.social_security_start_date && (
                    <p className="font-sans text-slate-400 text-xs mt-1">
                      When did / will you start collecting?
                    </p>
                  )}
                </div>
              </div>
            )}

          </div>
        ))}
      </div>

      <button
        onClick={addPerson}
        className="w-full border border-violet-800 border-dashed rounded-xl px-4 py-4 font-sans text-slate-400 hover:text-gold-400 hover:border-gold-600 text-sm transition-colors duration-150 flex items-center justify-center gap-2"
      >
        <span className="text-lg leading-none">+</span> Add Person
      </button>
    </div>
  )
}
