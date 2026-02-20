/**
 * IncomeTab
 *
 * CRUD for IncomeStream records.
 * Internal stream_id is hidden from users — auto-generated transparently.
 * Advanced date fields are collapsed by default.
 */

import { useEffect, useRef, useState } from 'react'
import type { IncomeStream, Person } from '@/types/scenario'
import { INCOME_STREAM_TYPES } from '@/types/scenario'

interface Props {
  streams: IncomeStream[]
  people: Person[]
  onChange: (streams: IncomeStream[]) => void
  autoAdd?: boolean
  onAutoAddDone?: () => void
}

const MONTHS      = Array.from({ length: 12 }, (_, i) => i + 1)
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const toDisplay = (d: number) => Math.round(d * 10000) / 100
const toDecimal = (p: number) => p / 100

function updateAt<T>(arr: T[], idx: number, fn: (item: T) => T): T[] {
  return arr.map((item, i) => (i === idx ? fn(item) : item))
}

const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select()

function IncomeStreamCard({
  stream,
  idx,
  people,
  onUpdate,
  onRemove,
}: {
  stream: IncomeStream
  idx: number
  people: Person[]
  onUpdate: (fn: (s: IncomeStream) => IncomeStream) => void
  onRemove: () => void
}) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const owner = people.find(p => p.person_id === stream.owner_person_id)

  return (
    <div className="py-5 first:pt-0">
      {/* header */}
      <div className="flex items-center justify-between mb-4">
        <span className="font-sans text-white text-sm font-semibold">
          {INCOME_STREAM_TYPES.find(t => t.value === stream.type)?.label ?? stream.type}
          {owner && <span className="text-slate-300 font-normal ml-2">— {owner.name}</span>}
        </span>
        <button
          onClick={onRemove}
          className="font-sans text-slate-400 hover:text-red-400 text-sm transition-colors px-2 py-1 rounded hover:bg-red-400/10"
        >
          Remove
        </button>
      </div>

      {/* row 1: type · owner · amount */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
            Income Type <span className="text-red-400">*</span>
          </label>
          <select
            value={stream.type}
            onChange={e => onUpdate(s => ({ ...s, type: e.target.value as IncomeStream['type'] }))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer focus:border-gold-600 focus:outline-none"
          >
            {INCOME_STREAM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
            Whose Income <span className="text-red-400">*</span>
          </label>
          <select
            value={stream.owner_person_id}
            disabled={people.length === 0}
            onChange={e => onUpdate(s => ({ ...s, owner_person_id: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer disabled:opacity-50 focus:border-gold-600 focus:outline-none"
          >
            {people.length === 0 && <option value="">— add a person first —</option>}
            {people.map(p => <option key={p.person_id} value={p.person_id}>{p.name || p.person_id}</option>)}
          </select>
        </div>

        <div>
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
            Monthly Amount <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 font-sans text-sm">$</span>
            <input
              type="number"
              value={stream.monthly_amount_at_start}
              min={0} step={100}
              onFocus={handleFocus}
              onChange={e => {
                const v = e.target.valueAsNumber
                onUpdate(s => ({ ...s, monthly_amount_at_start: isNaN(v) ? 0 : v }))
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white font-sans text-sm focus:border-gold-600 focus:outline-none"
            />
          </div>
          <p className="font-sans text-slate-400 text-xs mt-1">Amount at start of income</p>
        </div>
      </div>

      {/* row 2: start date · COLA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
        <div>
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
            Start Date <span className="text-red-400">*</span>
          </label>
          <input
            type="month"
            value={stream.start_month}
            onChange={e => onUpdate(s => ({ ...s, start_month: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm focus:border-gold-600 focus:outline-none"
          />
          <p className="font-sans text-slate-400 text-xs mt-1">When does this income begin?</p>
        </div>

        <div>
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
            Annual Cost-of-Living Increase
          </label>
          <div className="relative">
            <input
              type="number"
              value={toDisplay(stream.cola_percent_annual)}
              min={0} max={50} step={0.1}
              onFocus={handleFocus}
              onChange={e => {
                const v = e.target.valueAsNumber
                onUpdate(s => ({ ...s, cola_percent_annual: isNaN(v) ? 0 : toDecimal(v) }))
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 pr-7 py-2 text-white font-sans text-sm focus:border-gold-600 focus:outline-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 font-sans text-sm">%</span>
          </div>
          <p className="font-sans text-slate-400 text-xs mt-1">e.g. 2.5% — leave 0 if income stays flat</p>
        </div>
      </div>

      {/* advanced toggle */}
      <button
        onClick={() => setShowAdvanced(v => !v)}
        className="font-sans text-slate-300 hover:text-slate-300 text-xs transition-colors flex items-center gap-1 mb-3"
      >
        <span>{showAdvanced ? '▾' : '▸'}</span>
        {showAdvanced ? 'Hide' : 'Show'} advanced options
      </button>

      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-800/40 rounded-lg p-4">
          <div>
            <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              End Date
            </label>
            <input
              type="month"
              value={stream.end_month || ''}
              onChange={e => onUpdate(s => ({ ...s, end_month: e.target.value || null }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm focus:border-gold-600 focus:outline-none"
            />
            <p className="font-sans text-slate-400 text-xs mt-1">Leave blank if income continues indefinitely</p>
          </div>

          <div>
            <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              COLA Applied In
            </label>
            <select
              value={stream.cola_month}
              onChange={e => onUpdate(s => ({ ...s, cola_month: Number(e.target.value) }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm cursor-pointer focus:border-gold-600 focus:outline-none"
            >
              {MONTHS.map(m => <option key={m} value={m}>{MONTH_NAMES[m-1]}</option>)}
            </select>
            <p className="font-sans text-slate-400 text-xs mt-1">Which month the annual increase is applied</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function IncomeTab({ streams, people, onChange, autoAdd, onAutoAddDone }: Props) {
  const addStream = () => {
    onChange([...streams, {
      stream_id: `stream_${streams.length + 1}`,
      type: 'salary',
      owner_person_id: people.length > 0 ? people[0].person_id : '',
      start_month: '2026-01',
      end_month: null,
      monthly_amount_at_start: 0,
      cola_percent_annual: 0,
      cola_month: 1,
    }])
  }

  const removeStream = (idx: number) => onChange(streams.filter((_, i) => i !== idx))
  const update = (idx: number, fn: (s: IncomeStream) => IncomeStream) =>
    onChange(updateAt(streams, idx, fn))

  const didAutoAdd = useRef(false)
  useEffect(() => {
    if (autoAdd && !didAutoAdd.current) {
      didAutoAdd.current = true
      addStream()
      onAutoAddDone?.()
    }
    if (!autoAdd) didAutoAdd.current = false
  }, [autoAdd])

  return (
    <div>
      <p className="font-sans text-slate-400 text-sm mb-5">
        Add all recurring income sources — salary, pension, Social Security, or any other income.
        Each stream is tied to a specific person.
      </p>

      {people.length === 0 && (
        <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg px-4 py-3 mb-4 flex items-center gap-3">
          <span className="text-amber-400 text-lg">⚠️</span>
          <p className="font-sans text-amber-300 text-sm">
            Add at least one person in the <strong>People</strong> step before adding income streams.
          </p>
        </div>
      )}

      {streams.length === 0 && (
        <div className="text-center py-8 border border-dashed border-slate-700 rounded-xl mb-4">
          <p className="text-3xl mb-2">💰</p>
          <p className="font-sans text-slate-400 text-sm font-medium mb-1">No income streams added yet</p>
          <p className="font-sans text-slate-400 text-xs">Add salary, pension, Social Security, or other income below</p>
        </div>
      )}

      <div className={`divide-y divide-slate-800 ${streams.length > 0 ? 'mb-4' : ''}`}>
        {streams.map((stream, idx) => (
          <IncomeStreamCard
            key={idx}
            stream={stream}
            idx={idx}
            people={people}
            onUpdate={fn => update(idx, fn)}
            onRemove={() => removeStream(idx)}
          />
        ))}
      </div>

      <button
        onClick={addStream}
        disabled={people.length === 0}
        className="w-full border border-slate-700 border-dashed rounded-xl px-4 py-4 font-sans text-slate-400 hover:text-gold-400 hover:border-gold-600 disabled:opacity-40 disabled:hover:text-slate-400 disabled:hover:border-slate-700 text-sm transition-colors duration-150 flex items-center justify-center gap-2"
      >
        <span className="text-lg leading-none">+</span> Add Income Stream
      </button>
    </div>
  )
}
