/**
 * PeopleTab
 *
 * CRUD for Person records.  Each person is rendered as an always-open
 * form card separated by a divider.  Income streams reference people
 * by person_id, so changing an ID here is flagged with a helper note.
 */

import type { Person } from '@/types/scenario'

interface Props {
  people: Person[]
  onChange: (people: Person[]) => void
}

function updateAt<T>(arr: T[], idx: number, fn: (item: T) => T): T[] {
  return arr.map((item, i) => (i === idx ? fn(item) : item))
}

export default function PeopleTab({ people, onChange }: Props) {
  const addPerson = () => {
    const nextNum = people.length + 1
    onChange([...people, {
      person_id: `person_${nextNum}`,
      name: '',
      birth_date: new Date().toISOString().slice(0, 10),
      life_expectancy_years: null,
    }])
  }

  const removePerson = (idx: number) => onChange(people.filter((_, i) => i !== idx))

  const update = (idx: number, fn: (p: Person) => Person) => onChange(updateAt(people, idx, fn))

  return (
    <div>
      <p className="font-sans text-slate-500 text-xs mb-5">
        Add the people included in this retirement plan. Income streams are tied to a person by ID.
      </p>

      {people.length === 0 && (
        <p className="font-sans text-slate-600 text-sm text-center py-6">No people added yet.</p>
      )}

      <div className={`divide-y divide-slate-800 ${people.length > 0 ? 'mb-4' : ''}`}>
        {people.map((person, idx) => (
          <div key={idx} className="py-4 first:pt-0">
            {/* header */}
            <div className="flex items-center justify-between mb-3">
              <span className="font-sans text-slate-300 text-sm font-medium">
                {person.name || `Person ${idx + 1}`}
              </span>
              <button onClick={() => removePerson(idx)}
                className="font-sans text-slate-600 hover:text-danger text-lg leading-none transition-colors" title="Remove person">×</button>
            </div>

            {/* fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Name */}
              <div>
                <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Name <span className="text-danger">*</span>
                </label>
                <input type="text" value={person.name}
                  onChange={e => update(idx, p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Jon"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm placeholder-slate-600" />
              </div>

              {/* Birth Date */}
              <div>
                <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Birth Date <span className="text-danger">*</span>
                </label>
                <input type="date" value={person.birth_date}
                  onChange={e => update(idx, p => ({ ...p, birth_date: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm" />
              </div>

              {/* Life Expectancy */}
              <div>
                <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Life Expectancy (years)
                </label>
                <input type="number" value={person.life_expectancy_years ?? ''}
                  min={0} max={120}
                  onChange={e => {
                    const v = e.target.valueAsNumber
                    update(idx, p => ({ ...p, life_expectancy_years: isNaN(v) ? null : v }))
                  }}
                  placeholder="e.g. 85"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm placeholder-slate-600" />
              </div>
            </div>

            {/* Person ID */}
            <div className="mt-4 max-w-xs">
              <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Person ID</label>
              <input type="text" value={person.person_id}
                onChange={e => update(idx, p => ({ ...p, person_id: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm font-mono text-slate-400" />
              <p className="font-sans text-slate-600 text-xs mt-1">Referenced by income streams — change with care.</p>
            </div>
          </div>
        ))}
      </div>

      {/* add button */}
      <button onClick={addPerson}
        className="w-full border border-slate-700 border-dashed rounded-lg px-4 py-3 font-sans text-slate-500 hover:text-gold-500 hover:border-gold-600 text-sm transition-colors duration-150">
        + Add Person
      </button>
    </div>
  )
}
