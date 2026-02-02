/**
 * ProjectionResults
 *
 * Fetched via POST /scenarios/:id/projection on mount.
 * Default view is the Charts tab (4 visualisations).
 * Remaining tabs are the Phase 9 data tables.
 *
 * Charts tab renders each chart in its own card so they can
 * sit in a responsive grid.  Table tabs share a single card.
 */

import { useEffect, useState } from 'react'
import { useParams, Link }     from 'react-router-dom'
import { useScenario, useRunProjectionMutation } from '@/api/hooks'
import type { ProjectionResponse } from '@/types/api'

// ── tables (Phase 9) ──────────────────────────────────────────────────────
import SummaryCards        from '@/components/results/SummaryCards'
import NetIncomeTable      from '@/components/results/NetIncomeTable'
import AnnualTable         from '@/components/results/AnnualTable'
import TaxTable            from '@/components/results/TaxTable'
import MonthlyDetailTable  from '@/components/results/MonthlyDetailTable'

// ── charts (Phase 10) ─────────────────────────────────────────────────────
import PortfolioChart          from '@/components/results/PortfolioChart'
import CashFlowChart           from '@/components/results/CashFlowChart'
import IncomeCompositionChart  from '@/components/results/IncomeCompositionChart'
import TaxChart                from '@/components/results/TaxChart'

// ─── tabs ─────────────────────────────────────────────────────────────────

const TABS = ['Charts', 'Net Income', 'Annual', 'Tax', 'Monthly Detail'] as const
type Tab = typeof TABS[number]

// ─── CSV export ────────────────────────────────────────────────────────────

function generateCSV(results: ProjectionResponse): string {
  const net     = results.net_income_projections ?? []
  const monthly = results.monthly_projections    ?? []
  const portfolioByMonth = new Map(monthly.map(m => [m.month, m.total_investments]))

  const headers = [
    'Month',
    'Gross Cashflow',
    'Federal Tax',
    'State Tax',
    'Net Income',
    'Spending',
    'Surplus / Deficit',
    'Portfolio Balance',
  ]

  const rows = net.map(row => [
    row.month,
    row.gross_cashflow.toFixed(2),
    row.federal_tax_monthly_estimate.toFixed(2),
    row.state_tax_monthly_estimate.toFixed(2),
    row.net_income_after_tax.toFixed(2),
    row.inflation_adjusted_spending.toFixed(2),
    row.surplus_deficit.toFixed(2),
    (portfolioByMonth.get(row.month) ?? 0).toFixed(2),
  ])

  return [headers, ...rows].map(r => r.join(',')).join('\n')
}

function downloadCSV(results: ProjectionResponse) {
  const csv  = generateCSV(results)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${results.scenario_id}-projection.csv`
  document.body.appendChild(a)
  a.click()
  // defer cleanup — the browser needs a tick to start the download
  // before the blob URL is revoked
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 150)
}

// ─── component ────────────────────────────────────────────────────────────

export default function ProjectionResults() {
  const { id }           = useParams<{ id: string }>()
  const scenarioQuery    = useScenario(id ?? '')
  const projMut          = useRunProjectionMutation()
  const [activeTab, setActiveTab] = useState<Tab>('Charts')   // ← default to Charts

  // auto-run on mount
  useEffect(() => {
    if (id) projMut.mutate(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const results  = projMut.data as ProjectionResponse | undefined
  const scenario = scenarioQuery.data

  // ── loading / error ───────────────────────────────────────────────────
  if (projMut.isPending || !results) {
    return (
      <div className="animate-fade-in max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl text-white">Projection Results</h1>
            <p className="font-sans text-slate-500 text-sm mt-1">{scenario?.scenario_name ?? '…'}</p>
          </div>
          <Link to={`/scenarios/${id}`} className="font-sans text-slate-500 hover:text-gold-400 text-sm transition-colors">
            ← Back to Editor
          </Link>
        </div>

        {projMut.isError ? (
          <div className="bg-danger/10 border border-danger/30 rounded-lg px-5 py-4">
            <p className="font-sans text-danger text-sm">
              {(projMut.error as any)?.response?.data?.detail ?? 'Projection calculation failed.'}
            </p>
            <button onClick={() => id && projMut.mutate(id)}
              className="font-sans text-danger hover:text-danger/70 text-xs mt-2 transition-colors">
              Try again →
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center h-48">
            <p className="font-sans text-slate-500 text-sm animate-pulse-slow">Running projection…</p>
          </div>
        )}
      </div>
    )
  }

  // ── derive top-level stats ────────────────────────────────────────────
  const monthly           = results.monthly_projections ?? []
  const startingPortfolio = monthly.length > 0 ? monthly[0].total_investments : 0
  const endingPortfolio   = monthly.length > 0 ? monthly[monthly.length - 1].total_investments : 0
  const summary           = results.financial_summary!

  // ── main render ───────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in max-w-6xl">

      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl text-white">Projection Results</h1>
          <p className="font-sans text-slate-500 text-sm mt-1">
            {results.scenario_name}
            <span className="text-slate-600 ml-2">· {results.calculation_time_ms.toFixed(0)} ms</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => id && projMut.mutate(id)}
            className="font-sans text-slate-500 hover:text-gold-400 text-sm border border-slate-700 hover:border-gold-600 px-4 py-2 rounded-lg transition-colors duration-150"
          >
            ↻ Re-run
          </button>
          <button
            onClick={() => downloadCSV(results)}
            className="font-sans text-slate-500 hover:text-gold-400 text-sm border border-slate-700 hover:border-gold-600 px-4 py-2 rounded-lg transition-colors duration-150"
          >
            ↓ Export CSV
          </button>
          <Link to={`/scenarios/${id}`}
            className="font-sans text-slate-500 hover:text-gold-400 text-sm transition-colors">
            ← Back to Editor
          </Link>
        </div>
      </div>

      {/* summary cards */}
      <SummaryCards
        summary={summary}
        startingPortfolio={startingPortfolio}
        endingPortfolio={endingPortfolio}
        totalMonths={monthly.length}
      />

      {/* tab strip */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 mb-4">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`
              flex-1 font-sans text-xs font-semibold px-2 py-2 rounded-lg
              transition-colors duration-150 whitespace-nowrap
              ${activeTab === tab
                ? 'bg-slate-800 text-gold-500'
                : 'text-slate-500 hover:text-slate-300'
              }
            `}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── Charts tab: each chart lives in its own card, laid out in a grid ── */}
      {activeTab === 'Charts' ? (
        <div className="space-y-4">

          {/* Portfolio – full width */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <PortfolioChart data={monthly} />
          </div>

          {/* Cash Flow + Income Composition – side by side on lg */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <CashFlowChart data={results.net_income_projections ?? []} />
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <IncomeCompositionChart data={monthly} scenario={scenario ?? null} />
            </div>
          </div>

          {/* Tax Burden – full width */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <TaxChart data={results.tax_summaries ?? []} />
          </div>
        </div>

      ) : (
        /* ── Table tabs: single shared card ──────────────────────────────── */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {activeTab === 'Net Income'     && <NetIncomeTable     data={results.net_income_projections ?? []} />}
          {activeTab === 'Annual'         && <AnnualTable        annuals={results.annual_summaries ?? []}  taxes={results.tax_summaries ?? []} />}
          {activeTab === 'Tax'            && <TaxTable           data={results.tax_summaries ?? []} />}
          {activeTab === 'Monthly Detail' && <MonthlyDetailTable data={monthly} scenario={scenario ?? null} />}
        </div>
      )}
    </div>
  )
}
