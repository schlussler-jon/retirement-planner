/**
 * PortfolioChart
 *
 * Gold area chart: total investment balance month-by-month.
 * X-axis ticks land on each January, labelled with the year only.
 */

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { MonthlyProjection } from '@/types/api'

// ─── constants ────────────────────────────────────────────────────────────

const GOLD = '#c9a84c'

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
      <p style={{ fontFamily: 'ui-monospace, monospace', color: '#64748b', fontSize: 11, marginBottom: 4 }}>{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color, fontSize: 13, margin: 0, fontWeight: 600 }}>
          {fmtFull(entry.value)}
        </p>
      ))}
    </div>
  )
}

// ─── component ────────────────────────────────────────────────────────────

interface Props {
  data: MonthlyProjection[]
}

export default function PortfolioChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="font-sans text-slate-500 text-sm text-center py-10">No portfolio data available.</p>
  }

  const chartData = data.map(d => ({ month: d.month, Portfolio: d.total_investments }))
  const ticks     = data.filter(d => d.month.endsWith('-01')).map(d => d.month)

  return (
    <div>
      <div className="mb-4">
        <p className="font-sans text-slate-200 text-sm font-semibold">Portfolio Value</p>
        <p className="font-sans text-slate-600 text-xs mt-0.5">Total investment balance over the projection period</p>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={GOLD} stopOpacity={0.28} />
              <stop offset="100%" stopColor={GOLD} stopOpacity={0.01} />
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
          <Area
            type="monotone"
            dataKey="Portfolio"
            stroke={GOLD}
            strokeWidth={2}
            fill="url(#portfolioFill)"
            dot={false}
            activeDot={{ r: 4, fill: GOLD, stroke: '#1e293b', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
