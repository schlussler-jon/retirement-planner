/**
 * Home (Dashboard)
 *
 * Authenticated landing page.
 *   • Greeting + primary CTA
 *   • At-a-glance stats (4 metrics)
 *   • Scenario cards grid — each card links directly to editor and results
 *   • Onboarding empty state when no scenarios exist
 */

import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useScenarios, useQuickProjection } from '@/api/hooks'
import type { ScenarioListItem } from '@/types/api'
import ErrorBoundary from '@/components/ErrorBoundary'

// ─── helpers ────────────────────────────────────────────────────────────────

const pl  = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const fmt = (n: number) => '$' + Math.round(Math.abs(n)).toLocaleString()

// ─── Sparkline ──────────────────────────────────────────────────────────────

function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const w   = 160
  const h   = 40
  const pad = 2

  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2)
      const y = h - pad - ((v - min) / range) * (h - pad * 2)
      return `${x},${y}`
    })
    .join(' ')

  // Build a filled area path (line + drop down to baseline)
  const pts = values.map((v, i) => ({
    x: pad + (i / (values.length - 1)) * (w - pad * 2),
    y: h - pad - ((v - min) / range) * (h - pad * 2),
  }))
  const areaPath =
    `M ${pts[0].x},${h - pad} ` +
    pts.map(p => `L ${p.x},${p.y}`).join(' ') +
    ` L ${pts[pts.length - 1].x},${h - pad} Z`

  const strokeColor = positive ? '#22c55e' : '#ef4444'
  const fillColor   = positive ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)'

  return (
    <svg width={w} height={h} className="opacity-90">
      {/* filled area under the line */}
      <path d={areaPath} fill={fillColor} />
      {/* the line itself */}
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ─── ScenarioCard ───────────────────────────────────────────────────────────

function ScenarioCard({ sc }: { sc: ScenarioListItem }) {
  const quickQuery = useQuickProjection(sc.scenario_id, true)
  const quick      = quickQuery.data

  const positive = (quick?.portfolio_growth ?? 0) >= 0

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
      {/* name */}
      <p className="font-sans text-white text-sm font-semibold">{sc.scenario_name}</p>

      {/* counts */}
      <p className="font-sans text-slate-300 text-xs mt-2">
        {pl(sc.people_count, 'person')}
        {' · '}
        {pl(sc.income_streams_count, 'stream')}
        {' · '}
        {pl(sc.accounts_count, 'account')}
      </p>

      {/* shimmer while loading */}
      {quickQuery.isLoading && (
        <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
          <div className="h-3 w-32 bg-slate-800 rounded animate-pulse" />
          <div className="h-10 w-40 bg-slate-800 rounded animate-pulse" />
        </div>
      )}

      {/* sparkline + stats */}
      {quick && (
        <>
          {/* sparkline */}
          {quick.portfolio_series && quick.portfolio_series.length > 1 && (
            <div className="mt-3 pt-3 border-t border-slate-800">
              <p className="font-sans text-slate-400 text-xs mb-1.5">Portfolio over time</p>
              <Sparkline values={quick.portfolio_series} positive={positive} />
            </div>
          )}

          {/* stats */}
          <div className="flex items-end justify-between mt-3 pt-3 border-t border-slate-800">
            <div>
              <p className="font-sans text-slate-300 text-xs">Ending Portfolio</p>
              <p className="font-sans text-white text-sm font-semibold mt-0.5">
                {fmt(quick.ending_portfolio)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-sans text-slate-300 text-xs">Surplus / Deficit</p>
              <p className={`font-sans text-sm font-semibold mt-0.5 ${
                quick.financial_summary.total_surplus_deficit >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {quick.financial_summary.total_surplus_deficit >= 0 ? '' : '−'}
                {fmt(quick.financial_summary.total_surplus_deficit)}
              </p>
            </div>
          </div>
        </>
      )}

      {/* action links */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-800">
        <Link
          to={`/scenarios/${sc.scenario_id}`}
          className="font-sans text-gold-500 hover:text-gold-400 text-xs transition-colors"
        >
          Edit →
        </Link>
        <Link
          to={`/scenarios/${sc.scenario_id}/results`}
          className="font-sans text-slate-300 hover:text-gold-400 text-xs transition-colors"
        >
          Results →
        </Link>
      </div>
    </div>
  )
}

// ─── Home ───────────────────────────────────────────────────────────────────

export default function Home() {
  const { user } = useAuth()
  const scenariosQuery = useScenarios()
  const scenarios = scenariosQuery.data?.scenarios ?? []

  // greeting
  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // aggregate stats
  const totalPeople   = scenarios.reduce((s, sc) => s + sc.people_count, 0)
  const totalStreams   = scenarios.reduce((s, sc) => s + sc.income_streams_count, 0)
  const totalAccounts = scenarios.reduce((s, sc) => s + sc.accounts_count, 0)

  return (
    <ErrorBoundary level="page" pageName="Dashboard">
      <div className="animate-fade-in">

        {/* header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl text-white">
              {greeting}, <span className="text-gold-500">{user?.name?.split(' ')[0] ?? 'there'}</span>
            </h1>
            <p className="font-sans text-slate-300 text-sm mt-1">
              {scenarios.length === 0
                ? 'Create your first scenario to get started.'
                : `You have ${scenarios.length} scenario${scenarios.length !== 1 ? 's' : ''} saved.`}
            </p>
          </div>

          <Link
            to="/scenarios/new"
            className="inline-flex items-center gap-2 bg-gold-600 hover:bg-gold-500 text-slate-950 font-sans font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors duration-150"
          >
            <span className="text-lg leading-none">+</span>
            New Scenario
          </Link>
        </div>

        {/* stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Scenarios',      value: scenarios.length },
            { label: 'People',         value: totalPeople },
            { label: 'Income Streams', value: totalStreams },
            { label: 'Accounts',       value: totalAccounts },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <p className="font-sans text-slate-300 text-xs uppercase tracking-wider mb-1">{label}</p>
              <p className="font-display text-2xl text-white font-semibold">{value}</p>
            </div>
          ))}
        </div>

        {/* scenario cards */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-sans text-white text-sm font-semibold">Your Scenarios</h2>
            {scenarios.length > 0 && (
              <Link to="/scenarios" className="font-sans text-gold-500 hover:text-gold-400 text-xs transition-colors">
                View all →
              </Link>
            )}
          </div>

          {scenarios.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-6 py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <span className="text-gold-500 text-xl">📈</span>
              </div>
              <p className="font-sans text-white text-sm font-semibold">No scenarios yet</p>
              <p className="font-sans text-slate-300 text-xs mt-1.5 max-w-sm mx-auto leading-relaxed">
                A scenario models your retirement cash flow — income streams, investment accounts,
                taxes, and spending — projected month by month over your timeline.
              </p>
              <Link
                to="/scenarios/new"
                className="inline-flex items-center gap-2 mt-5 bg-gold-600 hover:bg-gold-500 text-slate-950 font-sans font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors duration-150"
              >
                <span className="text-lg leading-none">+</span>
                Create Your First Scenario
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {scenarios.map((sc) => (
                <ScenarioCard key={sc.scenario_id} sc={sc} />
              ))}
            </div>
          )}
        </div>

      </div>
    </ErrorBoundary>
  )
}
