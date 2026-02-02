/**
 * TaxChart
 *
 * ComposedChart: stacked bars (federal blue, state purple) on the left
 * dollar axis, overlaid with a gold line for effective tax rate on the
 * right percentage axis.  Yearly data so every year gets a tick.
 */

import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { TaxSummary } from '@/types/api'

// ─── constants ────────────────────────────────────────────────────────────

const GOLD   = '#c9a84c'
const BLUE   = '#60a5fa'
const PURPLE = '#a78bfa'

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

// ─── tooltip ──────────────────────────────────────────────────────────────
// Formats dollar entries normally and the rate entry as a percentage.

function TaxTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
      <p style={{ fontFamily: 'ui-monospace, monospace', color: '#64748b', fontSize: 11, marginBottom: 6 }}>{label}</p>
      {payload.map((entry: any, i: number) => {
        const isRate = entry.name === 'Eff. Rate'
        return (
          <p key={i} style={{ color: entry.color, fontSize: 12, margin: '2px 0 0', fontWeight: 500 }}>
            <span style={{ color: '#64748b', fontWeight: 400 }}>{entry.name}: </span>
            {isRate ? `${(entry.value * 100).toFixed(1)}%` : fmtFull(entry.value)}
          </p>
        )
      })}
    </div>
  )
}

// ─── component ────────────────────────────────────────────────────────────

interface Props {
  data: TaxSummary[]
}

export default function TaxChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="font-sans text-slate-500 text-sm text-center py-10">No tax data available.</p>
  }

  const chartData = data.map(d => ({
    year:          d.year,
    'Federal Tax': d.federal_tax,
    'State Tax':   d.state_tax,
    'Eff. Rate':   d.effective_tax_rate,
  }))

  return (
    <div>
      <div className="mb-4">
        <p className="font-sans text-slate-200 text-sm font-semibold">Tax Burden</p>
        <p className="font-sans text-slate-600 text-xs mt-0.5">Annual federal & state tax with effective rate overlay</p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 36, left: 4, bottom: 0 }}>
          <XAxis
            dataKey="year"
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
            interval="preserveStartEnd"
          />
          {/* left axis – dollar amounts */}
          <YAxis
            yAxisId="dollars"
            tickFormatter={fmtCompact}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 11 }}
            width={72}
          />
          {/* right axis – effective rate */}
          <YAxis
            yAxisId="rate"
            orientation="right"
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            axisLine={false}
            tickLine={false}
            tick={{ fill: GOLD, fontSize: 11 }}
            domain={[0, 'auto']}
            width={38}
          />
          <Tooltip content={<TaxTooltip />} cursor={{ stroke: '#334155', strokeWidth: 1 }} />
          <Legend
            wrapperStyle={{ paddingTop: 10 }}
            formatter={(value: string) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{value}</span>}
          />
          <Bar yAxisId="dollars" dataKey="Federal Tax" stackId="tax" fill={BLUE}   radius={[0, 0, 0, 0]} />
          <Bar yAxisId="dollars" dataKey="State Tax"   stackId="tax" fill={PURPLE} radius={[3, 3, 0, 0]} />
          <Line yAxisId="rate" type="monotone" dataKey="Eff. Rate" stroke={GOLD} strokeWidth={2.5} dot={{ fill: GOLD, r: 3, strokeWidth: 0 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
