/**
 * IncomeCompositionChart
 *
 * Stacked area chart — one band per income stream.  Stream keys are
 * extracted dynamically from the data; human-readable labels (type + owner)
 * come from the scenario object.  A legend sits below the chart.
 */

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { MonthlyProjection } from '@/types/api'
import type { Scenario }          from '@/types/scenario'
import { INCOME_STREAM_TYPES }    from '@/types/scenario'

// ─── palette ──────────────────────────────────────────────────────────────
// Ordered so the most common streams (pension, SSA) get the most distinct colours.

const COLORS = ['#c9a84c', '#34d399', '#60a5fa', '#f87171', '#a78bfa', '#fb923c', '#e879f9']

// ─── formatters ───────────────────────────────────────────────────────────

function fmtCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `$${(value / 1_000).toFixed(0)}K`
  return `$${Math.round(value)}`
}

function fmtFull(value: number): string {
  return '$' + Math.round(value).toLocaleString()
}

// ─── label builder ────────────────────────────────────────────────────────

function buildLabels(scenario: Scenario | null, keys: string[]): Record<string, string> {
  if (!scenario) return Object.fromEntries(keys.map(k => [k, k]))

  const personName = new Map(scenario.people.map(p => [p.person_id, p.name]))
  const out: Record<string, string> = {}

  for (const key of keys) {
    const stream = scenario.income_streams.find(s => s.stream_id === key)
    if (stream) {
      const typeName = INCOME_STREAM_TYPES.find(t => t.value === stream.type)?.label ?? stream.type
      const owner    = personName.get(stream.owner_person_id) ?? stream.owner_person_id
      out[key] = `${typeName} – ${owner}`
    } else {
      out[key] = key
    }
  }
  return out
}

// ─── tooltip ──────────────────────────────────────────────────────────────

function DarkTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
      <p style={{ fontFamily: 'ui-monospace, monospace', color: '#64748b', fontSize: 11, marginBottom: 6 }}>{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color, fontSize: 12, margin: '2px 0 0', fontWeight: 500 }}>
          <span style={{ color: '#64748b', fontWeight: 400 }}>{entry.name}: </span>
          {fmtFull(entry.value)}
        </p>
      ))}
    </div>
  )
}

// ─── component ────────────────────────────────────────────────────────────

interface Props {
  data:     MonthlyProjection[]
  scenario: Scenario | null
}

export default function IncomeCompositionChart({ data, scenario }: Props) {
  if (data.length === 0) {
    return <p className="font-sans text-slate-500 text-sm text-center py-10">No income data available.</p>
  }

  const streamKeys = Object.keys(data[0].income_by_stream)
  if (streamKeys.length === 0) {
    return <p className="font-sans text-slate-500 text-sm text-center py-10">No income streams defined in this scenario.</p>
  }

  const labels     = buildLabels(scenario, streamKeys)
  const labelKeys  = streamKeys.map(k => labels[k])   // human-readable keys used in chart rows
  const ticks      = data.filter(d => d.month.endsWith('-01')).map(d => d.month)

  // Flatten: { month, "Pension – Jon": 8625, "SSA – Jon": 2597, … }
  const chartData = data.map(d => {
    const row: Record<string, any> = { month: d.month }
    for (const key of streamKeys) {
      row[labels[key]] = d.income_by_stream[key] || 0
    }
    return row
  })

  return (
    <div>
      <div className="mb-4">
        <p className="font-sans text-slate-200 text-sm font-semibold">Income Sources</p>
        <p className="font-sans text-slate-600 text-xs mt-0.5">Breakdown of monthly income by stream</p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <XAxis
            dataKey="month"
            ticks={ticks}
            tickFormatter={(v: string) => v.slice(0, 4)}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
          />
          <YAxis
            tickFormatter={fmtCompact}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 11 }}
            width={72}
          />
          <Tooltip content={<DarkTooltip />} cursor={{ stroke: '#334155', strokeWidth: 1 }} />
          <Legend
            wrapperStyle={{ paddingTop: 10 }}
            formatter={(value: string) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{value}</span>}
          />
          {labelKeys.map((key, i) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stackId="income"
              stroke={COLORS[i % COLORS.length]}
              fill={COLORS[i % COLORS.length]}
              fillOpacity={0.55}
              strokeWidth={1}
              dot={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
