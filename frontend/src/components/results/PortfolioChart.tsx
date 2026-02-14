/**
 * PortfolioChart
 *
 * Stacked area chart: individual account balances month-by-month.
 * Colored by tax bucket, showing each account separately.
 */

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { MonthlyProjection } from '@/types/api'

// ─── types ────────────────────────────────────────────────────────────────

interface Account {
  account_id: string
  name: string
  tax_bucket: 'taxable' | 'tax_deferred' | 'roth'
}

interface Props {
  data: MonthlyProjection[]
  accounts: Account[]
}

// ─── constants ────────────────────────────────────────────────────────────

const TAX_BUCKET_COLORS: Record<string, string[]> = {
  taxable: ['#4ECDC4', '#20B2AA', '#5F9EA0'],      // Teal shades
  tax_deferred: ['#FFD700', '#DAA520', '#B8860B'], // Gold shades
  roth: ['#32CD32', '#228B22', '#00FF00'],         // Green shades
}

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
      {payload.reverse().map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color, fontSize: 13, margin: '2px 0', fontWeight: 600 }}>
          {entry.name}: {fmtFull(entry.value)}
        </p>
      ))}
    </div>
  )
}

// ─── component ────────────────────────────────────────────────────────────

export default function PortfolioChart({ data, accounts }: Props) {
  if (data.length === 0) {
    return <p className="font-sans text-slate-500 text-sm text-center py-10">No portfolio data available.</p>
  }

  // Assign colors to each account based on tax bucket
  const bucketColorIndex = new Map<string, number>()
  const accountColors = new Map<string, string>()
  
  accounts.forEach(acc => {
    const bucket = acc.tax_bucket
    const currentIndex = bucketColorIndex.get(bucket) || 0
    const colors = TAX_BUCKET_COLORS[bucket] || TAX_BUCKET_COLORS['taxable']
    const color = colors[currentIndex % colors.length]
    
    accountColors.set(acc.name, color)
    bucketColorIndex.set(bucket, currentIndex + 1)
  })

  // Build chart data with individual accounts - use account_id for lookup, name for display
  const chartData = data.map(d => {
    const row: any = { month: d.month }
    accounts.forEach(acc => {
      // Use account_id to look up balance, but name as the key for display
      row[acc.name] = d.balances_by_account?.[acc.account_id] || 0
    })
    return row
  })
  
  const ticks = data.filter(d => d.month.endsWith('-01')).map(d => d.month)

  return (
    <div>
      <div className="mb-4">
        <p className="font-sans text-slate-200 text-sm font-semibold">Portfolio Value by Account</p>
        <p className="font-sans text-slate-600 text-xs mt-0.5">Individual account balances over the projection period</p>
      </div>
      <ResponsiveContainer width="100%" height={280}>
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
            wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
            iconType="square"
          />
          {accounts.map((acc, i) => (
            <Area
              key={acc.account_id}
              type="monotone"
              dataKey={acc.name}
              stackId="1"
              stroke={accountColors.get(acc.name)}
              strokeWidth={1.5}
              fill={accountColors.get(acc.name)}
              fillOpacity={0.6}
              dot={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
