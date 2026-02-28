/**
 * MonteCarloChart
 *
 * Displays the fan/cone of 1,000 simulated portfolio outcomes.
 * Features:
 *   - 5 percentile bands (10th, 25th, 50th, 75th, 90th)
 *   - Deterministic projection line overlay
 *   - Ruin probability by age table
 *   - Result caching via localStorage
 *   - Headline success rate
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

// ─── Types ────────────────────────────────────────────────────────────────

interface MonteCarloData {
  scenario_id:          string
  scenario_name:        string
  years:                number[]
  percentile_10:        number[]
  percentile_25:        number[]
  percentile_50:        number[]
  percentile_75:        number[]
  percentile_90:        number[]
  ruin_by_age?:         Record<number, number>   // age -> % of sims that ran out
  success_rate:         number
  simulations:          number
  starting_portfolio:   number
  median_final:         number
  worst_final:          number
  best_final:           number
  weighted_mean_return: number
}

interface AnnualSummary {
  year: number
  end_of_year_total_investments: number
}

interface ChartRow {
  year:        number
  p10:         number
  p25:         number
  p50:         number
  p75:         number
  p90:         number
  band90:      [number, number]
  band75:      [number, number]
  deterministic?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────

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

function cacheKey(scenarioId: string) {
  return `montecarlo_v1_${scenarioId}`
}

function loadCached(scenarioId: string): MonteCarloData | null {
  try {
    const raw = localStorage.getItem(cacheKey(scenarioId))
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    // Cache expires after 24 hours
    if (Date.now() - ts > 24 * 60 * 60 * 1000) return null
    return data
  } catch {
    return null
  }
}

function saveCache(data: MonteCarloData) {
  try {
    localStorage.setItem(cacheKey(data.scenario_id), JSON.stringify({ data, ts: Date.now() }))
  } catch {}
}

// ─── Ruin Probability Table ───────────────────────────────────────────────

function RuinProbabilityTable({ ruinByAge }: { ruinByAge: Record<number, number> }) {
  const ages = Object.keys(ruinByAge).map(Number).sort((a, b) => a - b)
  if (ages.length === 0) return null

  return (
    <div className="mt-5">
      <h4 className="font-sans text-sm font-semibold text-white mb-2">Probability of Running Out of Money by Age</h4>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {ages.map(age => {
          const pct = ruinByAge[age]
          let bg = 'bg-green-900/30 border-green-800/40'
          let textColor = 'text-green-400'
          if (pct > 30)      { bg = 'bg-red-900/30 border-red-800/40';    textColor = 'text-red-400' }
          else if (pct > 15) { bg = 'bg-orange-900/30 border-orange-800/40'; textColor = 'text-orange-400' }
          else if (pct > 5)  { bg = 'bg-yellow-900/30 border-yellow-800/40'; textColor = 'text-yellow-400' }

          return (
            <div key={age} className={`rounded-lg border p-2 text-center ${bg}`}>
              <p className="font-sans text-slate-400 text-xs">Age {age}</p>
              <p className={`font-sans font-semibold text-sm mt-0.5 ${textColor}`}>{pct.toFixed(1)}%</p>
            </div>
          )
        })}
      </div>
      <p className="font-sans text-slate-500 text-xs mt-2">
        Percentage of simulations where the portfolio reached $0 by each age.
      </p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────

interface Props {
  scenarioId: string
}

export default function MonteCarloChart({ scenarioId }: Props) {
  const [data,          setData]          = useState<MonteCarloData | null>(null)
  const [annuals,       setAnnuals]       = useState<AnnualSummary[]>([])
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [ran,           setRan]           = useState(false)
  const [fromCache,     setFromCache]     = useState(false)

  // Load deterministic projection annuals once
  useEffect(() => {
    client.post(`/scenarios/${scenarioId}/projection`)
      .then(res => setAnnuals(res.data?.annual_summaries ?? []))
      .catch(() => {})
  }, [scenarioId])

  // Check cache on mount
  useEffect(() => {
    const cached = loadCached(scenarioId)
    if (cached) {
      setData(cached)
      setRan(true)
      setFromCache(true)
    }
  }, [scenarioId])

  const runSimulation = async (bustCache = false) => {
    if (bustCache) {
      try { localStorage.removeItem(cacheKey(scenarioId)) } catch {}
    }
    setLoading(true)
    setError(null)
    try {
      const res = await client.post<MonteCarloData>(`/scenarios/${scenarioId}/montecarlo`)
      setData(res.data)
      saveCache(res.data)
      setRan(true)
      setFromCache(false)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Simulation failed')
    } finally {
      setLoading(false)
    }
  }

  // Build chart rows merging Monte Carlo bands with deterministic line
  const deterministicByYear: Record<number, number> = {}
  annuals.forEach(a => { deterministicByYear[a.year] = a.end_of_year_total_investments })

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
        deterministic: deterministicByYear[year],
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
              ? <>
                  {data?.simulations.toLocaleString()} simulations with randomized market returns
                  {fromCache && <span className="ml-2 text-slate-500 text-xs">(cached — <button onClick={() => runSimulation(true)} className="text-gold-500 hover:text-gold-400 underline">refresh</button>)</span>}
                </>
              : 'Run 1,000 simulations to see the range of possible outcomes'
            }
          </p>
        </div>

        {/* Success rate badge */}
        {data && (
          <div className="text-right shrink-0 ml-4">
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
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-violet-800 rounded-xl">
          <p className="font-sans text-slate-300 text-sm mb-1 text-center max-w-sm">
            See how your plan holds up across 1,000 different market scenarios — from crashes to bull markets.
          </p>
          <p className="font-sans text-slate-500 text-xs mb-5 text-center">Takes about 2–3 seconds</p>
          <button
            onClick={() => runSimulation()}
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

                {/* 10th–90th percentile band */}
                <Area dataKey="band90" fill="rgba(99,102,241,0.12)" stroke="none" name="10th–90th %ile" legendType="none" />
                {/* 25th–75th percentile band */}
                <Area dataKey="band75" fill="rgba(99,102,241,0.22)" stroke="none" name="25th–75th %ile" legendType="none" />

                {/* Percentile lines */}
                <Line dataKey="p10" stroke="#ef4444" strokeWidth={1} dot={false} strokeDasharray="4 3" name="10th %ile" />
                <Line dataKey="p25" stroke="#f97316" strokeWidth={1} dot={false} strokeDasharray="4 3" name="25th %ile" />
                <Line dataKey="p50" stroke="#ffffff"  strokeWidth={2.5} dot={false} name="Median" />
                <Line dataKey="p75" stroke="#22c55e" strokeWidth={1} dot={false} strokeDasharray="4 3" name="75th %ile" />
                <Line dataKey="p90" stroke="#86efac" strokeWidth={1} dot={false} strokeDasharray="4 3" name="90th %ile" />

                {/* Deterministic projection line */}
                {annuals.length > 0 && (
                  <Line
                    dataKey="deterministic"
                    stroke="#eab308"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="6 3"
                    name="Your projection"
                  />
                )}

                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'sans-serif', color: '#94a3b8', paddingTop: 8 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Ruin probability by age */}
          {data?.ruin_by_age && Object.keys(data.ruin_by_age).length > 0 && (
            <RuinProbabilityTable ruinByAge={data.ruin_by_age} />
          )}

          {/* Footnote */}
          <div className="mt-4 flex items-start gap-2">
            <span className="text-slate-500 text-xs mt-0.5">ℹ</span>
            <p className="font-sans text-slate-500 text-xs leading-relaxed">
              Returns modeled using a normal distribution: mean {data?.weighted_mean_return}% (your weighted account return),
              std dev 12% (historical market volatility). The gold dashed line shows your deterministic projection assuming
              fixed returns every year. This is not a guarantee of future performance.
            </p>
          </div>

          <button
            onClick={() => runSimulation(true)}
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
