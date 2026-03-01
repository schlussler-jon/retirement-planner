/**
 * RothStrategyTab
 *
 * Analyzes the impact of Roth conversions on:
 *  - Future RMD amounts
 *  - Lifetime federal taxes
 *  - Medicare IRMAA exposure
 *
 * Shows side-by-side baseline vs optimized projection.
 */

import { useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import client from '@/api/client'

// ─── Types ────────────────────────────────────────────────────────────────

interface RmdYear {
  year:              number
  age:               number
  deferred_balance:  number
  roth_balance:      number
  rmd_amount:        number
  conversion_amount: number
  total_income:      number
  taxable_income:    number
  federal_tax:       number
  effective_rate:    number
  irmaa_flag:        boolean
}

interface RothStrategyData {
  scenario_id:              string
  scenario_name:            string
  baseline:                 RmdYear[]
  baseline_lifetime_tax:    number
  baseline_peak_rmd:        number
  optimized:                RmdYear[]
  optimized_lifetime_tax:   number
  optimized_peak_rmd:       number
  conversion_amount:        number
  conversion_start_year:    number
  conversion_end_year:      number
  lifetime_tax_savings:     number
  rmd_reduction_pct:        number
  conversion_window_years:  number
  oldest_person_name:       string
  oldest_birth_year:        number
  deferred_balance:         number
  roth_balance:             number
  filing_status:            string
  weighted_return:          number
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const fmt  = (n: number) => '$' + Math.round(Math.abs(n)).toLocaleString()
const fmtK = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000)     return '$' + Math.round(n / 1_000) + 'K'
  return '$' + Math.round(n)
}

// Build chart data merging baseline + optimized by year
function buildChartData(data: RothStrategyData) {
  const byYear: Record<number, any> = {}
  data.baseline.forEach(r => {
    byYear[r.year] = {
      year:          r.year,
      age:           r.age,
      baseline_rmd:  r.rmd_amount,
      baseline_tax:  r.federal_tax,
      baseline_rate: r.effective_rate,
      baseline_irmaa: r.irmaa_flag,
    }
  })
  data.optimized.forEach(r => {
    if (!byYear[r.year]) byYear[r.year] = { year: r.year, age: r.age }
    byYear[r.year].optimized_rmd        = r.rmd_amount
    byYear[r.year].optimized_tax        = r.federal_tax
    byYear[r.year].optimized_rate       = r.effective_rate
    byYear[r.year].conversion           = r.conversion_amount
    byYear[r.year].optimized_irmaa      = r.irmaa_flag
  })
  return Object.values(byYear).sort((a, b) => a.year - b.year)
}

// ─── Stat Card ────────────────────────────────────────────────────────────

function StatCard({ label, before, after, format, lowerIsBetter = true }:
  { label: string; before: number; after: number; format: (n: number) => string; lowerIsBetter?: boolean }) {
  const diff    = after - before
  const better  = lowerIsBetter ? diff < 0 : diff > 0
  const pct     = before !== 0 ? Math.abs(diff / before * 100).toFixed(1) : '0'
  const diffColor = better ? 'text-green-400' : diff === 0 ? 'text-slate-400' : 'text-red-400'

  return (
    <div className="bg-slate-800/50 border border-violet-900 rounded-xl p-4">
      <p className="font-sans text-slate-400 text-xs uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-end gap-3">
        <div>
          <p className="font-sans text-slate-500 text-xs mb-0.5">Current</p>
          <p className="font-sans text-white text-lg font-semibold">{format(before)}</p>
        </div>
        <div className="text-slate-600 text-lg mb-0.5">→</div>
        <div>
          <p className="font-sans text-slate-500 text-xs mb-0.5">With Conversions</p>
          <p className="font-sans text-white text-lg font-semibold">{format(after)}</p>
        </div>
      </div>
      {diff !== 0 && (
        <p className={`font-sans text-xs mt-2 font-semibold ${diffColor}`}>
          {better ? '▼' : '▲'} {format(Math.abs(diff))} ({pct}%) {better ? 'improvement' : 'increase'}
        </p>
      )}
    </div>
  )
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-slate-900 border border-violet-800 rounded-xl p-3 text-xs font-sans shadow-xl">
      <p className="text-white font-semibold mb-2">{label} · Age {d?.age}</p>
      {d?.baseline_rmd  > 0 && <p className="text-slate-400">Current RMD: <span className="text-white">{fmt(d.baseline_rmd)}</span></p>}
      {d?.optimized_rmd > 0 && <p className="text-violet-300">Optimized RMD: <span className="text-white">{fmt(d.optimized_rmd)}</span></p>}
      {d?.conversion    > 0 && <p className="text-gold-400">Conversion: <span className="text-white">{fmt(d.conversion)}</span></p>}
      {d?.baseline_tax  > 0 && <p className="text-slate-400 mt-1">Current Tax: <span className="text-white">{fmt(d.baseline_tax)}</span> ({d.baseline_rate}%)</p>}
      {d?.optimized_tax > 0 && <p className="text-violet-300">Optimized Tax: <span className="text-white">{fmt(d.optimized_tax)}</span> ({d.optimized_rate}%)</p>}
      {d?.baseline_irmaa && <p className="text-red-400 mt-1">⚠ IRMAA surcharge (current)</p>}
      {d?.optimized_irmaa && <p className="text-orange-400">⚠ IRMAA surcharge (optimized)</p>}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────

interface Props {
  scenarioId: string
}

export default function RothStrategyTab({ scenarioId }: Props) {
  const [data,          setData]          = useState<RothStrategyData | null>(null)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [activeChart,   setActiveChart]   = useState<'rmd' | 'tax'>('rmd')

  // User-adjustable params
  const [convAmount,    setConvAmount]    = useState<string>('')
  const [convStartYear, setConvStartYear] = useState<string>('')
  const [convEndYear,   setConvEndYear]   = useState<string>('')
  const [targetBracket, setTargetBracket] = useState<string>('0.22')

  const runAnalysis = async () => {
    setLoading(true)
    setError(null)
    try {
      const payload: any = { target_bracket: parseFloat(targetBracket) }
      if (convAmount)    payload.conversion_amount     = parseFloat(convAmount)
      if (convStartYear) payload.conversion_start_year = parseInt(convStartYear)
      if (convEndYear)   payload.conversion_end_year   = parseInt(convEndYear)

      const res = await client.post<RothStrategyData>(
        `/scenarios/${scenarioId}/roth-strategy`, payload
      )
      setData(res.data)

      // Populate fields with calculated values if not set
      if (!convAmount)    setConvAmount(String(res.data.conversion_amount))
      if (!convStartYear) setConvStartYear(String(res.data.conversion_start_year))
      if (!convEndYear)   setConvEndYear(String(res.data.conversion_end_year))
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const chartData = data ? buildChartData(data) : []
  const rmdStartAge = 73

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-slate-900 border border-violet-900 rounded-xl p-6">
        <h3 className="font-sans text-lg font-semibold text-white mb-1">Roth Conversion Strategy</h3>
        <p className="font-sans text-slate-400 text-sm">
          Model the impact of converting tax-deferred funds to Roth before RMDs begin at age 73.
          Reducing your tax-deferred balance now can dramatically lower forced withdrawals and lifetime taxes.
        </p>

        {/* Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div>
            <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Annual Conversion
            </label>
            <input
              type="number"
              value={convAmount}
              onChange={e => setConvAmount(e.target.value)}
              placeholder="Auto"
              className="w-full bg-slate-800 border border-violet-800 rounded-lg px-3 py-2 text-white font-sans text-sm placeholder-slate-600 focus:border-gold-600 focus:outline-none"
            />
            <p className="font-sans text-slate-500 text-xs mt-1">Leave blank to auto-optimize</p>
          </div>

          <div>
            <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Start Year
            </label>
            <input
              type="number"
              value={convStartYear}
              onChange={e => setConvStartYear(e.target.value)}
              placeholder="Auto"
              className="w-full bg-slate-800 border border-violet-800 rounded-lg px-3 py-2 text-white font-sans text-sm placeholder-slate-600 focus:border-gold-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              End Year
            </label>
            <input
              type="number"
              value={convEndYear}
              onChange={e => setConvEndYear(e.target.value)}
              placeholder="Auto"
              className="w-full bg-slate-800 border border-violet-800 rounded-lg px-3 py-2 text-white font-sans text-sm placeholder-slate-600 focus:border-gold-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Target Bracket
            </label>
            <select
              value={targetBracket}
              onChange={e => setTargetBracket(e.target.value)}
              className="w-full bg-slate-800 border border-violet-800 rounded-lg px-3 py-2 text-white font-sans text-sm focus:border-gold-600 focus:outline-none"
            >
              <option value="0.12">12% bracket</option>
              <option value="0.22">22% bracket</option>
              <option value="0.24">24% bracket</option>
              <option value="0.32">32% bracket</option>
            </select>
            <p className="font-sans text-slate-500 text-xs mt-1">Fill conversions up to this rate</p>
          </div>
        </div>

        <button
          onClick={runAnalysis}
          disabled={loading}
          className="mt-4 font-sans bg-gold-600 hover:bg-gold-500 disabled:opacity-60 text-slate-950 font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors"
        >
          {loading ? 'Analyzing…' : data ? '↺ Re-run Analysis' : 'Run Roth Analysis'}
        </button>
        {error && <p className="font-sans text-red-400 text-xs mt-2">{error}</p>}
      </div>

      {data && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard
              label="Lifetime Federal Tax"
              before={data.baseline_lifetime_tax}
              after={data.optimized_lifetime_tax}
              format={fmt}
              lowerIsBetter
            />
            <StatCard
              label="Peak RMD Amount"
              before={data.baseline_peak_rmd}
              after={data.optimized_peak_rmd}
              format={fmt}
              lowerIsBetter
            />
            <div className="bg-slate-800/50 border border-violet-900 rounded-xl p-4">
              <p className="font-sans text-slate-400 text-xs uppercase tracking-wider mb-2">Conversion Plan</p>
              <p className="font-sans text-white text-lg font-semibold">{fmt(data.conversion_amount)}/yr</p>
              <p className="font-sans text-slate-400 text-xs mt-1">
                {data.conversion_start_year}–{data.conversion_end_year} ({data.conversion_window_years} years)
              </p>
              {data.lifetime_tax_savings > 0 && (
                <p className="font-sans text-green-400 text-xs mt-2 font-semibold">
                  ▼ {fmt(data.lifetime_tax_savings)} lifetime tax savings
                </p>
              )}
              {data.lifetime_tax_savings <= 0 && (
                <p className="font-sans text-slate-400 text-xs mt-2">
                  No net savings — conversions may cost more now
                </p>
              )}
            </div>
          </div>

          {/* Chart toggle */}
          <div className="bg-slate-900 border border-violet-900 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-sans text-white font-semibold">
                {activeChart === 'rmd' ? 'RMD Amounts by Year' : 'Federal Tax by Year'}
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveChart('rmd')}
                  className={`font-sans text-xs px-3 py-1.5 rounded-lg transition-colors ${activeChart === 'rmd' ? 'bg-violet-800 text-white' : 'text-slate-400 hover:text-white border border-violet-900'}`}
                >
                  RMD Impact
                </button>
                <button
                  onClick={() => setActiveChart('tax')}
                  className={`font-sans text-xs px-3 py-1.5 rounded-lg transition-colors ${activeChart === 'tax' ? 'bg-violet-800 text-white' : 'text-slate-400 hover:text-white border border-violet-900'}`}
                >
                  Tax Impact
                </button>
              </div>
            </div>

            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1b4b" />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'sans-serif' }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={fmtK}
                    tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'sans-serif' }}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'sans-serif', color: '#94a3b8', paddingTop: 8 }} />

                  {activeChart === 'rmd' ? (
                    <>
                      <Bar dataKey="baseline_rmd"  name="Current RMD"       fill="#ef4444" opacity={0.7} radius={[2,2,0,0]} />
                      <Bar dataKey="optimized_rmd" name="Optimized RMD"     fill="#7c3aed" opacity={0.9} radius={[2,2,0,0]} />
                      <Bar dataKey="conversion"    name="Roth Conversion"   fill="#eab308" opacity={0.8} radius={[2,2,0,0]} />
                    </>
                  ) : (
                    <>
                      <Bar dataKey="baseline_tax"  name="Current Tax"       fill="#ef4444" opacity={0.7} radius={[2,2,0,0]} />
                      <Bar dataKey="optimized_tax" name="Optimized Tax"     fill="#7c3aed" opacity={0.9} radius={[2,2,0,0]} />
                      <Line dataKey="baseline_rate"  name="Current Rate %"  stroke="#f97316" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
                      <Line dataKey="optimized_rate" name="Optimized Rate %" stroke="#22c55e" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* IRMAA warning */}
            {data.optimized.some(r => r.irmaa_flag) && (
              <div className="mt-4 flex items-start gap-2 bg-orange-900/20 border border-orange-800/40 rounded-lg p-3">
                <span className="text-orange-400 text-sm">⚠</span>
                <p className="font-sans text-orange-300 text-xs leading-relaxed">
                  Some years exceed the Medicare IRMAA threshold (~${data.filing_status === 'married_filing_jointly' ? '212,000' : '106,000'}).
                  This triggers an income-related surcharge on Medicare Part B & D premiums.
                  Consider sizing conversions to stay below this threshold.
                </p>
              </div>
            )}
          </div>

          {/* Data table */}
          <div className="bg-slate-900 border border-violet-900 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-violet-900">
              <h4 className="font-sans text-white font-semibold">Year-by-Year Detail</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-sans">
                <thead>
                  <tr className="border-b border-violet-900/50">
                    <th className="px-4 py-3 text-left text-slate-400 font-semibold">Year</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-semibold">Age</th>
                    <th className="px-4 py-3 text-right text-slate-400 font-semibold">Conversion</th>
                    <th className="px-4 py-3 text-right text-red-400 font-semibold">RMD (Current)</th>
                    <th className="px-4 py-3 text-right text-violet-400 font-semibold">RMD (Optimized)</th>
                    <th className="px-4 py-3 text-right text-red-400 font-semibold">Tax (Current)</th>
                    <th className="px-4 py-3 text-right text-violet-400 font-semibold">Tax (Optimized)</th>
                    <th className="px-4 py-3 text-right text-slate-400 font-semibold">Savings</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((row, i) => {
                    const savings = (row.baseline_tax || 0) - (row.optimized_tax || 0)
                    const isRmdYear = row.age >= rmdStartAge
                    return (
                      <tr key={row.year}
                        className={`border-b border-violet-900/30 ${isRmdYear ? 'bg-violet-950/20' : ''} hover:bg-slate-800/40`}>
                        <td className="px-4 py-2.5 text-white">{row.year}</td>
                        <td className="px-4 py-2.5 text-slate-300">
                          {row.age}
                          {isRmdYear && <span className="ml-1 text-violet-400 text-xs">RMD</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-yellow-400">
                          {row.conversion > 0 ? fmt(row.conversion) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-300">
                          {row.baseline_rmd > 0 ? fmt(row.baseline_rmd) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-violet-300">
                          {row.optimized_rmd > 0 ? fmt(row.optimized_rmd) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-300">
                          {fmt(row.baseline_tax || 0)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-violet-300">
                          {fmt(row.optimized_tax || 0)}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-semibold ${savings > 0 ? 'text-green-400' : savings < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                          {savings > 0 ? fmt(savings) : savings < 0 ? `-${fmt(Math.abs(savings))}` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footnote */}
          <p className="font-sans text-slate-500 text-xs text-center pb-2">
            RMDs calculated using IRS Uniform Lifetime Table. Tax estimates use 2025 federal brackets with standard deduction.
            State taxes and Social Security taxation not included. Consult a financial advisor before implementing.
          </p>
        </>
      )}
    </div>
  )
}
