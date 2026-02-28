/**
 * Home (Dashboard)
 *
 * Authenticated landing page.
 *   • Greeting + primary CTA
 *   • Scenario cards grid — each card links directly to editor and results
 *   • Duplicate, Export, Delete actions on each card
 *   • Onboarding empty state when no scenarios exist
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useScenarios, useDeleteScenario, useQuickProjection, qk } from '@/api/hooks'
import client from '@/api/client'
import type { ScenarioListItem } from '@/types/api'
import type { Scenario } from '@/types/scenario'
import ErrorBoundary from '@/components/ErrorBoundary'
import { exportScenarioAsFile } from '@/utils/storage'

// ─── helpers ────────────────────────────────────────────────────────────────

const pl  = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const fmt = (n: number) => '$' + Math.round(Math.abs(n)).toLocaleString()
const humanizeType = (t: string) =>
  t.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

// ─── Sparkline ──────────────────────────────────────────────────────────────

function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  if (values.length < 2) return null

  const [tooltip, setTooltip] = useState<{ x: number; y: number; value: number; index: number } | null>(null)

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const w   = 160
  const h   = 40
  const pad = 2

  const pts = values.map((v, i) => ({
    x: pad + (i / (values.length - 1)) * (w - pad * 2),
    y: h - pad - ((v - min) / range) * (h - pad * 2),
    v,
  }))

  const points   = pts.map(p => `${p.x},${p.y}`).join(' ')
  const areaPath =
    `M ${pts[0].x},${h - pad} ` +
    pts.map(p => `L ${p.x},${p.y}`).join(' ') +
    ` L ${pts[pts.length - 1].x},${h - pad} Z`

  const strokeColor = positive ? '#22c55e' : '#ef4444'
  const fillColor   = positive ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)'

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = (e.clientX - rect.left) * (w / rect.width)
    let closest = 0
    let minDist = Infinity
    pts.forEach((p, i) => {
      const dist = Math.abs(p.x - mouseX)
      if (dist < minDist) { minDist = dist; closest = i }
    })
    setTooltip({ x: pts[closest].x, y: pts[closest].y, value: pts[closest].v, index: closest })
  }

  const startYear = new Date().getFullYear()

  return (
    <div className="relative inline-block">
      <svg
        width={w} height={h}
        className="opacity-90 cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <path d={areaPath} fill={fillColor} />
        <polyline points={points} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {tooltip && (
          <circle cx={tooltip.x} cy={tooltip.y} r={3} fill={strokeColor} />
        )}
      </svg>
      {tooltip && (
        <div
          className="absolute bottom-full mb-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs font-sans text-white whitespace-nowrap pointer-events-none z-10"
          style={{
            left: tooltip.x,
            transform: tooltip.index > values.length / 2 ? 'translateX(-100%)' : 'translateX(-50%)',
          }}
        >
          <span className="text-slate-400">{startYear + tooltip.index}:</span> ${Math.round(tooltip.value).toLocaleString()}
        </div>
      )}
    </div>
  )
}

// ─── ScenarioCard ───────────────────────────────────────────────────────────

interface CardProps {
  sc: ScenarioListItem
  onDuplicate: (id: string, name: string) => Promise<void>
  onExport: (id: string) => void
  onDelete: (id: string, name: string) => Promise<void>
  dupStatus?: 'loading' | 'done' | 'error'
}

function ScenarioCard({ sc, onDuplicate, onExport, onDelete, dupStatus }: CardProps) {
  const quickQuery = useQuickProjection(sc.scenario_id, true)
  const quick      = quickQuery.data
  const positive   = (quick?.portfolio_growth ?? 0) >= 0

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
      {/* name */}
      <p className="font-sans text-white text-sm font-semibold">{sc.scenario_name}</p>

      {/* description */}
      {sc.description && (
        <p className="font-sans text-slate-400 text-xs mt-1 leading-relaxed">{sc.description}</p>
      )}

      {/* counts */}
      <p className="font-sans text-slate-300 text-xs mt-2">
        {pl(sc.people_count, 'person')}
        {' · '}
        {pl(sc.income_streams_count, 'income stream')}
        {' · '}
        {pl(sc.accounts_count, 'account')}
      </p>

      {/* income stream labels */}
      {sc.income_stream_labels && sc.income_stream_labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {sc.income_stream_labels.map((t, i) => (
            <span key={i} className="font-sans text-xs bg-slate-800 text-slate-300 rounded px-1.5 py-0.5">
              {humanizeType(t)}
            </span>
          ))}
        </div>
      )}

      {/* account names */}
      {sc.account_names && sc.account_names.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {sc.account_names.map((name, i) => (
            <span key={i} className="font-sans text-xs bg-slate-800/60 text-slate-400 rounded px-1.5 py-0.5 border border-slate-700/50">
              {name}
            </span>
          ))}
        </div>
      )}

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
          {quick.portfolio_series && quick.portfolio_series.length > 1 && (
            <div className="mt-3 pt-3 border-t border-slate-800">
              <p className="font-sans text-slate-400 text-xs mb-1.5">Portfolio over time</p>
              <Sparkline values={quick.portfolio_series} positive={positive} />
            </div>
          )}

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

      {/* primary actions */}
      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-800">
        <Link
          to={`/scenarios/${sc.scenario_id}`}
          className="font-sans text-slate-300 hover:text-white text-xs border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg transition-colors"
        >
          Edit →
        </Link>
        <Link
          to={`/scenarios/${sc.scenario_id}/results`}
          className="font-sans bg-gold-600 hover:bg-gold-500 text-slate-950 font-semibold text-xs px-4 py-1.5 rounded-lg transition-colors"
        >
          View Results →
        </Link>
      </div>

      {/* secondary actions */}
      <div className="flex items-center gap-4 mt-2">
        <button
          onClick={() => onDuplicate(sc.scenario_id, sc.scenario_name)}
          disabled={dupStatus === 'loading'}
          className="font-sans text-slate-400 hover:text-gold-400 text-xs transition-colors disabled:opacity-50"
        >
          {dupStatus === 'loading' ? 'Duplicating…'
            : dupStatus === 'done'    ? '✓ Duplicated'
            : dupStatus === 'error'   ? '✗ Failed'
            : 'Duplicate'}
        </button>
        <button
          onClick={() => onExport(sc.scenario_id)}
          className="font-sans text-slate-400 hover:text-gold-400 text-xs transition-colors"
        >
          Export JSON
        </button>
        <button
          onClick={() => onDelete(sc.scenario_id, sc.scenario_name)}
          className="font-sans text-slate-400 hover:text-red-400 text-xs transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

// ─── Home ───────────────────────────────────────────────────────────────────

export default function Home() {
  const { user }       = useAuth()
  const scenariosQuery = useScenarios()
  const deleteMut      = useDeleteScenario()
  const qc             = useQueryClient()
  const scenarios      = scenariosQuery.data?.scenarios ?? []

  const [dupStatus, setDupStatus] = useState<Record<string, 'loading' | 'done' | 'error'>>({})

  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const clearDup = (id: string, ms = 2500) =>
    setTimeout(() => setDupStatus(prev => { const n = { ...prev }; delete n[id]; return n }), ms)

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    await deleteMut.mutateAsync(id)
  }

  const handleDuplicate = async (id: string, name: string) => {
    setDupStatus(prev => ({ ...prev, [id]: 'loading' }))
    try {
      const { data: original } = await client.get<Scenario>(`/scenarios/${id}`)
      const newId = crypto.randomUUID()
      await client.post('/scenarios', {
        ...original,
        scenario_id:   newId,
        scenario_name: `${name} (copy)`,
      })
      await qc.invalidateQueries({ queryKey: qk.scenarios() })
      setDupStatus(prev => ({ ...prev, [id]: 'done' }))
      clearDup(id)
    } catch {
      setDupStatus(prev => ({ ...prev, [id]: 'error' }))
      clearDup(id, 3000)
    }
  }

  const handleExport = async (id: string) => {
    const { data: scenario } = await client.get<Scenario>(`/scenarios/${id}`)
    exportScenarioAsFile(scenario)
  }

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

        {/* scenario cards */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-sans text-white text-sm font-semibold">
              Your {scenarios.length} Scenario{scenarios.length !== 1 ? 's' : ''}
            </h2>
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
                <ScenarioCard
                  key={sc.scenario_id}
                  sc={sc}
                  onDuplicate={handleDuplicate}
                  onExport={handleExport}
                  onDelete={handleDelete}
                  dupStatus={dupStatus[sc.scenario_id]}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </ErrorBoundary>
  )
}
