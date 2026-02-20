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

export default function PeopleTab({ people, onChange, autoAdd, onAutoAddDone }: Props) {
  const addPerson = () => {
    const nextNum = people.length + 1
    onChange([...people, {
      person_id: `person_${nextNum}`,
      name: '',
      birth_date: '1965-01-01',
      life_expectancy_years: 90,
    }])
  }

  const removePerson = (idx: number) => onChange(people.filter((_, i) => i !== idx))
  const update = (idx: number, fn: (p: Person) => Person) => onChange(updateAt(people, idx, fn))

  // Trigger add when WhatsNext button is clicked
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
        <div className="text-center py-8 border border-dashed border-slate-700 rounded-xl mb-4">
          <p className="text-3xl mb-2">👤</p>
          <p className="font-sans text-slate-400 text-sm font-medium mb-1">No people added yet</p>
          <p className="font-sans text-slate-400 text-xs">Click "Add Person" below to get started</p>
        </div>
      )}

      <div className={`divide-y divide-slate-800 ${people.length > 0 ? 'mb-4' : ''}`}>
        {people.map((person, idx) => (
          <div key={idx} className="py-5 first:pt-0">
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={person.name}
                  onChange={e => update(idx, p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Jon"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm placeholder-slate-600 focus:border-gold-600 focus:outline-none"
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
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm focus:border-gold-600 focus:outline-none"
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
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 pr-14 py-2 text-white font-sans text-sm placeholder-slate-600 focus:border-gold-600 focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 font-sans text-xs">years</span>
                </div>
                <p className="font-sans text-slate-400 text-xs mt-1">How long to run the projection</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addPerson}
        className="w-full border border-slate-700 border-dashed rounded-xl px-4 py-4 font-sans text-slate-400 hover:text-gold-400 hover:border-gold-600 text-sm transition-colors duration-150 flex items-center justify-center gap-2"
      >
        <span className="text-lg leading-none">+</span> Add Person
      </button>
    </div>
  )
}
