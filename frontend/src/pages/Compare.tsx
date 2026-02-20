/**
 * Compare
 *
 * Side-by-side comparison of two scenarios:
 *   • Picker row   – two dropdowns fed from the live scenario list
 *   • Summary grid – 4 key metrics, winner cell highlighted green
 *   • Portfolio    – two lines overlaid on one chart
 *   • Cash Flow    – Net Income (solid) + Spending (dashed) × 2 scenarios
 *   • Monthly table – 7 columns, amber row when any metric diverges > 5 %
 */

import { useState, useEffect } from 'react'
import { useScenarios, useRunProjectionMutation } from '@/api/hooks'
import type { ProjectionResponse } from '@/types/api'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// ─── constants ────────────────────────────────────────────────────────────────

const GOLD     = '#c9a84c'
const GOLD_DIM = '#8a7035'
const BLUE     = '#5b8dd9'
const BLUE_DIM = '#3a5a8a'

// ─── formatters ──────────────────────────────────────────────────────────────

function fmtCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `$${(value / 1_000).toFixed(0)}K`
  return `$${Math.round(value)}`
}

function fmtDollar(n: number): string {
  const sign = n < 0 ? '−' : ''
  return sign + '$' + Math.round(Math.abs(n)).toLocaleString()
}

function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + '%'
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** True when |a − b| / max(|a|, |b|) exceeds the threshold */
function diverges(a: number, b: number, threshold = 0.05): boolean {
  const max = Math.max(Math.abs(a), Math.abs(b))
  if (max === 0) return false
  return Math.abs(a - b) / max > threshold
}

/** Sorted union of every month key present in either array */
function unionMonths(a: { month: string }[], b: { month: string }[]): string[] {
  const set = new Set([...a.map(r => r.month), ...b.map(r => r.month)])
  return Array.from(set).sort()
}

// ─── tooltip ─────────────────────────────────────────────────────────────────

function DarkTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
      <p style={{ fontFamily: 'ui-monospace, monospace', color: '#64748b', fontSize: 11, marginBottom: 6 }}>{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color, fontSize: 12, margin: '2px 0 0', fontWeight: 500 }}>
          <span style={{ color: '#64748b', fontWeight: 400 }}>{entry.name}: </span>
          {fmtDollar(entry.value)}
        </p>
      ))}
    </div>
  )
}

// ─── component ───────────────────────────────────────────────────────────────

export default function Compare() {
  const scenariosQuery = useScenarios()
  const scenarios      = scenariosQuery.data?.scenarios ?? []

  const [idA, setIdA] = useState('')
  const [idB, setIdB] = useState('')

  const projA = useRunProjectionMutation()
  const projB = useRunProjectionMutation()

  // fire each projection independently when its picker changes
  useEffect(() => { if (idA) projA.mutate(idA) }, [idA]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (idB) projB.mutate(idB) }, [idB]) // eslint-disable-line react-hooks/exhaustive-deps

  const resultsA = projA.data as ProjectionResponse | undefined
  const resultsB = projB.data as ProjectionResponse | undefined

  // ── names ───────────────────────────────────────────────────────────────────
  const nameA = resultsA?.scenario_name ?? scenarios.find(s => s.scenario_id === idA)?.scenario_name ?? 'Scenario A'
  const nameB = resultsB?.scenario_name ?? scenarios.find(s => s.scenario_id === idB)?.scenario_name ?? 'Scenario B'

  // ── derived (safe to compute even when not both ready — values just stay 0) ─
  const monthlyA = resultsA?.monthly_projections  ?? []
  const monthlyB = resultsB?.monthly_projections  ?? []
  const netA     = resultsA?.net_income_projections ?? []
  const netB     = resultsB?.net_income_projections ?? []

  const months   = unionMonths(monthlyA, monthlyB)
  const ticks    = months.filter(m => m.endsWith('-01'))

  // portfolio maps
  const portMapA = new Map(monthlyA.map(m => [m.month, m.total_investments]))
  const portMapB = new Map(monthlyB.map(m => [m.month, m.total_investments]))

  // net income maps (full row so we can reach surplus_deficit)
  const netMapA  = new Map(netA.map(m => [m.month, m]))
  const netMapB  = new Map(netB.map(m => [m.month, m]))

  // ── summary metrics ─────────────────────────────────────────────────────────
  const endingA  = monthlyA.at(-1)?.total_investments ?? 0
  const endingB  = monthlyB.at(-1)?.total_investments ?? 0
  const surplusA = resultsA?.financial_summary?.total_surplus_deficit ?? 0
  const surplusB = resultsB?.financial_summary?.total_surplus_deficit ?? 0
  const taxRateA = resultsA?.financial_summary
    ? resultsA.financial_summary.total_taxes / (resultsA.financial_summary.total_gross_income || 1) : 0
  const taxRateB = resultsB?.financial_summary
    ? resultsB.financial_summary.total_taxes / (resultsB.financial_summary.total_gross_income || 1) : 0
  const spendA   = resultsA?.financial_summary?.total_spending ?? 0
  const spendB   = resultsB?.financial_summary?.total_spending ?? 0

  // ── chart data ──────────────────────────────────────────────────────────────
  const portfolioData = months.map(month => ({
    month,
    portfolioA: portMapA.get(month) ?? 0,
    portfolioB: portMapB.get(month) ?? 0,
  }))

  const cashFlowData = months.map(month => ({
    month,
    netA:   netMapA.get(month)?.net_income_after_tax        ?? 0,
    spendA: netMapA.get(month)?.inflation_adjusted_spending ?? 0,
    netB:   netMapB.get(month)?.net_income_after_tax        ?? 0,
    spendB: netMapB.get(month)?.inflation_adjusted_spending ?? 0,
  }))

  // ── table data ──────────────────────────────────────────────────────────────
  const tableData = months.map(month => ({
    month,
    aNet:  netMapA.get(month)?.net_income_after_tax ?? 0,
    aSurp: netMapA.get(month)?.surplus_deficit      ?? 0,
    aPrt:  portMapA.get(month)                      ?? 0,
    bNet:  netMapB.get(month)?.net_income_after_tax ?? 0,
    bSurp: netMapB.get(month)?.surplus_deficit      ?? 0,
    bPrt:  portMapB.get(month)                      ?? 0,
  }))

  const bothReady = !!(resultsA && resultsB)

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in max-w-6xl">

      {/* header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl text-white">Compare Scenarios</h1>
        <p className="font-sans text-slate-300 text-sm mt-1">
          Pick two scenarios to see them side by side.
        </p>
      </div>

      {/* ── not enough scenarios ── */}
      {scenarios.length < 2 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-6 py-12 text-center">
          <p className="font-sans text-slate-300 text-sm">
            {scenarios.length === 0
              ? 'You need at least two scenarios to compare. Create your first on the dashboard.'
              : 'You need one more scenario to unlock comparison.'}
          </p>
        </div>
      ) : (
        <>
          {/* ── pickers ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <div>
              <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Scenario A
              </label>
              <select value={idA} onChange={e => setIdA(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white font-sans text-sm appearance-none cursor-pointer">
                <option value="" disabled>Select…</option>
                {scenarios.map(s => (
                  <option key={s.scenario_id} value={s.scenario_id} disabled={s.scenario_id === idB}>
                    {s.scenario_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Scenario B
              </label>
              <select value={idB} onChange={e => setIdB(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white font-sans text-sm appearance-none cursor-pointer">
                <option value="" disabled>Select…</option>
                {scenarios.map(s => (
                  <option key={s.scenario_id} value={s.scenario_id} disabled={s.scenario_id === idA}>
                    {s.scenario_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── prompt / loading / error ── */}
          {(!idA || !idB) && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-6 py-12 text-center">
              <p className="font-sans text-slate-300 text-sm">Select both scenarios above to begin comparison.</p>
            </div>
          )}

          {(idA && idB) && (projA.isError || projB.isError) && (
            <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 mb-4">
              {projA.isError && (
                <p className="font-sans text-danger text-sm">
                  {nameA}: {(projA.error as any)?.response?.data?.detail ?? 'Projection failed.'}
                  <button onClick={() => projA.mutate(idA)}
                    className="font-sans text-danger hover:text-danger/70 text-xs ml-3 transition-colors">Retry →</button>
                </p>
              )}
              {projB.isError && (
                <p className="font-sans text-danger text-sm mt-1">
                  {nameB}: {(projB.error as any)?.response?.data?.detail ?? 'Projection failed.'}
                  <button onClick={() => projB.mutate(idB)}
                    className="font-sans text-danger hover:text-danger/70 text-xs ml-3 transition-colors">Retry →</button>
                </p>
              )}
            </div>
          )}

          {(idA && idB && !bothReady && !projA.isError && !projB.isError) && (
            <div className="flex items-center justify-center h-48">
              <p className="font-sans text-slate-300 text-sm animate-pulse-slow">Running projections…</p>
            </div>
          )}

          {/* ── main comparison ── */}
          {bothReady && (
            <>
              {/* ─── summary metrics grid ─── */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-4">
                {/* column headers */}
                <div className="grid grid-cols-3 border-b border-slate-800">
                  <div className="px-4 py-3" />
                  <div className="px-4 py-3 border-l border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: GOLD }} />
                      <p className="font-sans text-slate-300 text-xs font-semibold truncate">{nameA}</p>
                    </div>
                  </div>
                  <div className="px-4 py-3 border-l border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: BLUE }} />
                      <p className="font-sans text-slate-300 text-xs font-semibold truncate">{nameB}</p>
                    </div>
                  </div>
                </div>

                {/* metric rows */}
                {([
                  { label: 'Ending Portfolio',   a: endingA,  b: endingB,  fmt: fmtDollar, higherWins: true },
                  { label: 'Surplus / Deficit',  a: surplusA, b: surplusB, fmt: fmtDollar, higherWins: true },
                  { label: 'Effective Tax Rate', a: taxRateA, b: taxRateB, fmt: fmtPct,    higherWins: false },
                  { label: 'Total Spending',     a: spendA,   b: spendB,   fmt: fmtDollar, higherWins: false },
                ] as const).map(({ label, a, b, fmt, higherWins }) => {
                  const aWins = higherWins ? a > b : a < b
                  const bWins = higherWins ? b > a : b < a
                  return (
                    <div key={label} className="grid grid-cols-3 border-b border-slate-800 last:border-b-0">
                      <div className="px-4 py-3">
                        <p className="font-sans text-slate-300 text-xs">{label}</p>
                      </div>
                      <div className={`px-4 py-3 border-l border-slate-800 ${aWins ? 'bg-success/10' : ''}`}>
                        <p className={`font-sans text-sm font-semibold ${aWins ? 'text-success' : 'text-slate-300'}`}>
                          {fmt(a)}
                        </p>
                      </div>
                      <div className={`px-4 py-3 border-l border-slate-800 ${bWins ? 'bg-success/10' : ''}`}>
                        <p className={`font-sans text-sm font-semibold ${bWins ? 'text-success' : 'text-slate-300'}`}>
                          {fmt(b)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* ─── portfolio overlay ─── */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
                <div className="mb-3">
                  <p className="font-sans text-slate-200 text-sm font-semibold">Portfolio Value</p>
                  <p className="font-sans text-slate-400 text-xs mt-0.5">Total investment balance over the projection period</p>
                </div>
                <div className="flex items-center gap-5 mb-3">
                  {[{ color: GOLD, label: nameA }, { color: BLUE, label: nameB }].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                      <span className="font-sans text-slate-400 text-xs">{label}</span>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={portfolioData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                    <XAxis dataKey="month" ticks={ticks}
                      tickFormatter={(v: string) => v.slice(0, 4)}
                      axisLine={{ stroke: '#334155' }} tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'ui-monospace, monospace' }} />
                    <YAxis tickFormatter={fmtCompact} axisLine={false} tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 11 }} width={72} />
                    <Tooltip content={<DarkTooltip />} cursor={{ stroke: '#334155', strokeWidth: 1 }} />
                    <Line type="monotone" dataKey="portfolioA" name={nameA} stroke={GOLD} strokeWidth={2} dot={false}
                      activeDot={{ r: 3, fill: GOLD, stroke: '#1e293b', strokeWidth: 2 }} />
                    <Line type="monotone" dataKey="portfolioB" name={nameB} stroke={BLUE} strokeWidth={2} dot={false}
                      activeDot={{ r: 3, fill: BLUE, stroke: '#1e293b', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* ─── cash flow overlay ─── */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
                <div className="mb-3">
                  <p className="font-sans text-slate-200 text-sm font-semibold">Monthly Cash Flow</p>
                  <p className="font-sans text-slate-400 text-xs mt-0.5">Net income (solid) vs spending (dashed) for each scenario</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
                  {[
                    { color: GOLD,     label: `${nameA} — Net` },
                    { color: GOLD_DIM, label: `${nameA} — Spend` },
                    { color: BLUE,     label: `${nameB} — Net` },
                    { color: BLUE_DIM, label: `${nameB} — Spend` },
                  ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                      <span className="font-sans text-slate-400 text-xs">{label}</span>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={cashFlowData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                    <XAxis dataKey="month" ticks={ticks}
                      tickFormatter={(v: string) => v.slice(0, 4)}
                      axisLine={{ stroke: '#334155' }} tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'ui-monospace, monospace' }} />
                    <YAxis tickFormatter={fmtCompact} axisLine={false} tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 11 }} width={72} />
                    <Tooltip content={<DarkTooltip />} cursor={{ stroke: '#334155', strokeWidth: 1 }} />
                    <Line type="monotone" dataKey="netA"   name={`${nameA} Net`}   stroke={GOLD}     strokeWidth={2}   dot={false} activeDot={{ r: 3, fill: GOLD,     stroke: '#1e293b', strokeWidth: 2 }} />
                    <Line type="monotone" dataKey="spendA" name={`${nameA} Spend`} stroke={GOLD_DIM} strokeWidth={1.5} strokeDasharray="4 3" dot={false} activeDot={{ r: 3, fill: GOLD_DIM, stroke: '#1e293b', strokeWidth: 2 }} />
                    <Line type="monotone" dataKey="netB"   name={`${nameB} Net`}   stroke={BLUE}     strokeWidth={2}   dot={false} activeDot={{ r: 3, fill: BLUE,     stroke: '#1e293b', strokeWidth: 2 }} />
                    <Line type="monotone" dataKey="spendB" name={`${nameB} Spend`} stroke={BLUE_DIM} strokeWidth={1.5} strokeDasharray="4 3" dot={false} activeDot={{ r: 3, fill: BLUE_DIM, stroke: '#1e293b', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* ─── monthly comparison table ─── */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="max-h-96 overflow-y-auto overflow-x-auto">
                  <table className="w-full min-w-max text-left">
                    <thead className="sticky top-0 bg-slate-900 z-10">
                      {/* scenario name row */}
                      <tr className="border-b border-slate-800">
                        <th className="px-4 py-2.5 font-sans text-slate-300 text-xs font-semibold uppercase tracking-wider">Month</th>
                        <th colSpan={3} className="px-4 py-2.5 font-sans text-xs font-semibold border-l border-slate-800 whitespace-nowrap" style={{ color: GOLD }}>{nameA}</th>
                        <th colSpan={3} className="px-4 py-2.5 font-sans text-xs font-semibold border-l border-slate-800 whitespace-nowrap" style={{ color: BLUE }}>{nameB}</th>
                      </tr>
                      {/* sub-header row */}
                      <tr className="border-b border-slate-800" style={{ background: 'rgba(30,41,59,0.6)' }}>
                        <th className="px-4 py-2" />
                        <th className="px-4 py-2 font-sans text-slate-300 text-xs border-l border-slate-800">Net Income</th>
                        <th className="px-4 py-2 font-sans text-slate-300 text-xs">Surplus</th>
                        <th className="px-4 py-2 font-sans text-slate-300 text-xs">Portfolio</th>
                        <th className="px-4 py-2 font-sans text-slate-300 text-xs border-l border-slate-800">Net Income</th>
                        <th className="px-4 py-2 font-sans text-slate-300 text-xs">Surplus</th>
                        <th className="px-4 py-2 font-sans text-slate-300 text-xs">Portfolio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map(row => {
                        const highlight = diverges(row.aNet, row.bNet) ||
                                          diverges(row.aSurp, row.bSurp) ||
                                          diverges(row.aPrt, row.bPrt)
                        return (
                          <tr key={row.month} className={`border-b border-slate-800/50 ${highlight ? 'bg-amber-900/15' : ''}`}>
                            <td className="px-4 py-1.5 font-sans font-mono text-slate-400 text-xs whitespace-nowrap">{row.month}</td>
                            <td className="px-4 py-1.5 font-sans text-slate-300 text-xs text-right border-l border-slate-800">{fmtDollar(row.aNet)}</td>
                            <td className={`px-4 py-1.5 font-sans text-xs text-right ${row.aSurp >= 0 ? 'text-success' : 'text-danger'}`}>{fmtDollar(row.aSurp)}</td>
                            <td className="px-4 py-1.5 font-sans text-slate-300 text-xs text-right">{fmtDollar(row.aPrt)}</td>
                            <td className="px-4 py-1.5 font-sans text-slate-300 text-xs text-right border-l border-slate-800">{fmtDollar(row.bNet)}</td>
                            <td className={`px-4 py-1.5 font-sans text-xs text-right ${row.bSurp >= 0 ? 'text-success' : 'text-danger'}`}>{fmtDollar(row.bSurp)}</td>
                            <td className="px-4 py-1.5 font-sans text-slate-300 text-xs text-right">{fmtDollar(row.bPrt)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* highlight legend */}
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'rgba(120,53,15,0.3)', border: '1px solid rgba(180,83,30,0.3)' }} />
                <p className="font-sans text-slate-400 text-xs">Rows where scenarios diverge by more than 5 %</p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
