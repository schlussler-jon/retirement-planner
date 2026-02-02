/**
 * CashFlowChart
 *
 * Two overlapping areas: Net Income (gold) and Spending (slate).
 * When gold sits above slate the gap is surplus; when slate rises
 * above gold that region is deficit — readable at a glance.
 *
 * Uses the corrected field names: estimated_federal_tax / estimated_state_tax
 * (applied via the Phase 9 NaN fix).  This component only reads
 * net_income_after_tax and the spending fields, so it works regardless.
 */

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { NetIncomeProjection } from '@/types/api'

// ─── constants ────────────────────────────────────────────────────────────

const GOLD  = '#c9a84c'
const SLATE = '#60748b'   // slightly lighter than axis ticks for visibility

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
  data: NetIncomeProjection[]
}

export default function CashFlowChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="font-sans text-slate-500 text-sm text-center py-10">No cash-flow data available.</p>
  }

  const chartData = data.map(d => ({
    month:       d.month,
    'Net Income': d.net_income_after_tax,
    'Spending':   d.survivor_spending_applied ?? d.inflation_adjusted_spending,
  }))

  const ticks = data.filter(d => d.month.endsWith('-01')).map(d => d.month)

  return (
    <div>
      <div className="mb-4">
        <p className="font-sans text-slate-200 text-sm font-semibold">Monthly Cash Flow</p>
        <p className="font-sans text-slate-600 text-xs mt-0.5">Net income after tax vs monthly spending</p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="netIncFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={GOLD}  stopOpacity={0.22} />
              <stop offset="100%" stopColor={GOLD}  stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={SLATE} stopOpacity={0.22} />
              <stop offset="100%" stopColor={SLATE} stopOpacity={0.01} />
            </linearGradient>
          </defs>
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
          <Area type="monotone" dataKey="Net Income" stroke={GOLD}  strokeWidth={2} fill="url(#netIncFill)"  dot={false} activeDot={{ r: 3, fill: GOLD,  stroke: '#1e293b', strokeWidth: 2 }} />
          <Area type="monotone" dataKey="Spending"   stroke={SLATE} strokeWidth={2} fill="url(#spendFill)"  dot={false} activeDot={{ r: 3, fill: SLATE, stroke: '#1e293b', strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
