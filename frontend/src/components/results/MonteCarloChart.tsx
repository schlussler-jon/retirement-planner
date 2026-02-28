/**
 * MonteCarloChart
 *
 * Displays the fan/cone of 1,000 simulated portfolio outcomes.
 * Shows 5 percentile bands (10th, 25th, 50th, 75th, 90th) and a
 * headline success rate number.
 */

import { useEffect, useState } from 'react'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import client from '@/api/client'

interface MonteCarloData {
  scenario_id:          string
  scenario_name:        string
  years:                number[]
  percentile_10:        number[]
  percentile_25:        number[]
  percentile_50:        number[]
  percentile_75:        number[]
  percentile_90:        number[]
  success_rate:         number
  simulations:          number
  starting_portfolio:   number
  median_final:         number
  worst_final:          number
  best_final:           number
  weighted_mean_return: number
}

interface ChartRow {
  year:   number
  p10:    number
  p25:    number
  p50:    number
  p75:    number
  p90:    number
  band90: [number, number]  // p10 to p90
  band75: [number, number]  // p25 to p75
}

function fmt(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return '$' + Math.round(n / 1_000) + 'K'
  return '$' + Math.round(n).toLocaleString()
}

function successColor(rate: number): string {
  if (rate >= 90) return '#22c55e'
  if (rate >= 75) return '#eab308'
  if (rate >= 60) return '#f97316'
  return '#ef4444'
}

function successLabel(rate: number): string {
  if (rate >= 90) return 'Excellent'
  if (rate >= 75) return 'Good'
  if (rate >= 60) return 'Moderate'
  return 'At Risk'
}

interface Props {
  scenarioId: string
}

export default function MonteCarloChart({ scenarioId }: Props) {
  const [data,    setData]    = useState<MonteCarloData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [ran,     setRan]     = useState(false)

  const runSimulation = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await client.post<MonteCarloData>(`/scenarios/${scenarioId}/montecarlo`)
      setData(res.data)
      setRan(true)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Simulation failed')
    } finally {
      setLoading(false)
    }
  }

  // Build chart rows
  const chartData: ChartRow[] = data
    ? data.years.map((year, i) => ({
        year,
        p10:    data.percentile_10[i],
        p25:    data.percentile_25[i],
        p50:    data.percentile_50[i],
        p75:    data.percentile_75[i],
        p90:    data.percentile_90[i],
        band90: [data.percentile_10[i], data.percentile_90[i]],
        band75: [data.percentile_25[i], data.percentile_75[i]],
      }))
    : []

  const color = data ? successColor(data.success_rate) : '#22c55e'

  return (
    <div className="bg-slate-900 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-sans text-lg font-semibold text-white">Monte Carlo Analysis</h3>
          <p className="font-sans text-slate-400 text-sm mt-0.5">
            {ran
              ? `${data?.simulations.toLocaleString()} simulations with randomized market returns`
              : 'Run 1,000 simulations to see the range of possible outcomes'}
          </p>
        </div>

        {/* Success rate badge */}
        {data && (
          <div className="text-right">
            <p className="font-sans text-slate-400 text-xs">Plan Success Rate</p>
            <p className="font-display text-4xl font-bold mt-0.5" style={{ color }}>
              {data.success_rate}%
            </p>
            <p className="font-sans text-xs font-semibold mt-0.5" style={{ color }}>
              {successLabel(data.success_rate)}
            </p>
          </div>
        )}
      </div>

      {/* Stats row */}
      {data && (
        <div className="grid grid-cols-3 gap-3 mb-5 mt-4">
          <div className="bg-slate-800/60 rounded-lg p-3 text-center">
            <p className="font-sans text-slate-400 text-xs">Worst Case (5th %ile)</p>
            <p className="font-sans text-red-400 text-sm font-semibold mt-0.5">{fmt(data.worst_final)}</p>
          </div>
          <div className="bg-slate-800/60 rounded-lg p-3 text-center">
            <p className="font-sans text-slate-400 text-xs">Median Outcome</p>
            <p className="font-sans text-white text-sm font-semibold mt-0.5">{fmt(data.median_final)}</p>
          </div>
          <div className="bg-slate-800/60 rounded-lg p-3 text-center">
            <p className="font-sans text-slate-400 text-xs">Best Case (95th %ile)</p>
            <p className="font-sans text-green-400 text-sm font-semibold mt-0.5">{fmt(data.best_final)}</p>
          </div>
        </div>
      )}

      {/* Chart or CTA */}
      {!ran ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-slate-700 rounded-xl">
          <p className="font-sans text-slate-300 text-sm mb-1 text-center max-w-sm">
            See how your plan holds up across 1,000 different market scenarios — from crashes to bull markets.
          </p>
          <p className="font-sans text-slate-500 text-xs mb-5 text-center">Takes about 2–3 seconds</p>
          <button
            onClick={runSimulation}
            disabled={loading}
            className="font-sans bg-gold-600 hover:bg-gold-500 disabled:opacity-60 text-slate-950 font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors"
          >
            {loading ? 'Running 1,000 simulations…' : 'Run Monte Carlo Analysis'}
          </button>
          {error && <p className="font-sans text-red-400 text-xs mt-3">{error}</p>}
        </div>
      ) : (
        <>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="year"
                  tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'sans-serif' }}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={fmt}
                  tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'sans-serif' }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontFamily: 'sans-serif' }}
                  labelStyle={{ color: '#94a3b8', fontSize: 12 }}
                  itemStyle={{ fontSize: 12 }}
                  formatter={(value: number) => fmt(value)}
                  labelFormatter={(year) => `Year ${year}`}
                />

                {/* 10th–90th percentile band (outer, lighter) */}
                <Area
                  dataKey="band90"
                  fill="rgba(99,102,241,0.12)"
                  stroke="none"
                  name="10th–90th %ile"
                  legendType="none"
                />

                {/* 25th–75th percentile band (inner, stronger) */}
                <Area
                  dataKey="band75"
                  fill="rgba(99,102,241,0.22)"
                  stroke="none"
                  name="25th–75th %ile"
                  legendType="none"
                />

                {/* Percentile lines */}
                <Line dataKey="p10" stroke="#ef4444" strokeWidth={1} dot={false} strokeDasharray="4 3" name="10th %ile" />
                <Line dataKey="p25" stroke="#f97316" strokeWidth={1} dot={false} strokeDasharray="4 3" name="25th %ile" />
                <Line dataKey="p50" stroke="#ffffff"  strokeWidth={2.5} dot={false} name="Median" />
                <Line dataKey="p75" stroke="#22c55e" strokeWidth={1} dot={false} strokeDasharray="4 3" name="75th %ile" />
                <Line dataKey="p90" stroke="#86efac" strokeWidth={1} dot={false} strokeDasharray="4 3" name="90th %ile" />

                <Legend
                  wrapperStyle={{ fontSize: 11, fontFamily: 'sans-serif', color: '#94a3b8', paddingTop: 8 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Footnote */}
          <div className="mt-4 flex items-start gap-2">
            <span className="text-slate-500 text-xs mt-0.5">ℹ</span>
            <p className="font-sans text-slate-500 text-xs leading-relaxed">
              Returns modeled using a normal distribution: mean {data?.weighted_mean_return}% (your weighted account return), 
              std dev 12% (historical market volatility). Each simulation draws independent annual returns — 
              some years great, some terrible, just like real markets.
              This is not a guarantee of future performance.
            </p>
          </div>

          {/* Re-run button */}
          <button
            onClick={runSimulation}
            disabled={loading}
            className="mt-3 font-sans text-slate-400 hover:text-gold-400 text-xs transition-colors disabled:opacity-50"
          >
            {loading ? 'Running…' : '↺ Re-run simulation'}
          </button>
        </>
      )}
    </div>
  )
}
