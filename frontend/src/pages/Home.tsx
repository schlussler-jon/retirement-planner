/**
 * Home (Dashboard)
 *
 * Authenticated landing page.
 *   • Greeting + Import + Compare + New Scenario
 *   • Scenario cards with speedometer Plan Health Score, sparkline
 *   • Duplicate, Export, Delete actions on each card
 *   • Onboarding empty state when no scenarios exist
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useScenarios, useDeleteScenario, useQuickProjection, qk } from '@/api/hooks'
import client from '@/api/client'
import type { ScenarioListItem, QuickProjectionResponse } from '@/types/api'
import type { Scenario } from '@/types/scenario'
import ErrorBoundary from '@/components/ErrorBoundary'
import { exportScenarioAsFile, importScenarioFromFile } from '@/utils/storage'

// ─── helpers ────────────────────────────────────────────────────────────────

const pl  = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const fmt = (n: number) => '$' + Math.round(Math.abs(n)).toLocaleString()
const humanizeType = (t: string) =>
  t.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

// ─── Plan Health Score ───────────────────────────────────────────────────────

function calcHealthScore(quick: QuickProjectionResponse, sc: ScenarioListItem): {
  score: number
  label: string
  color: string
  insight: string
} {
  const fs = quick.financial_summary

  // 1. Survival Rate (35 pts)
  const survivalRate = quick.total_months > 0 ? fs.months_in_surplus / quick.total_months : 0
  const survivalPts  = Math.round(survivalRate * 35)

  // 2. Portfolio Growth (25 pts) — full points at 2x
  const growthRatio = quick.starting_portfolio > 0
    ? quick.ending_portfolio / quick.starting_portfolio : 1
  const growthPts = Math.min(25, Math.round((growthRatio / 2) * 25))

  // 3. Surplus Cushion (25 pts)
  const avgMonthlySpending = quick.total_months > 0 ? fs.total_spending / quick.total_months : 1
  const cushionRatio = avgMonthlySpending > 0
    ? fs.average_monthly_surplus_deficit / avgMonthlySpending : 0
  const cushionPts = Math.min(25, Math.max(0, Math.round(cushionRatio * 25)))

  // 4. Contribution Discipline (15 pts)
  const contribPts = (sc.accounts_count ?? 0) > 0 ? 15 : 0

  const score = survivalPts + growthPts + cushionPts + contribPts

  let label: string, color: string
  if (score >= 80)      { label = 'Strong Plan';  color = '#22c55e' }
  else if (score >= 60) { label = 'On Track';     color = '#eab308' }
  else if (score >= 40) { label = 'Needs Work';   color = '#f97316' }
  else                  { label = 'At Risk';      color = '#ef4444' }

  const breakdown = [
    { label: 'Survival Rate',    pts: survivalPts,  max: 35 },
    { label: 'Portfolio Growth', pts: growthPts,    max: 25 },
    { label: 'Surplus Cushion',  pts: cushionPts,   max: 25 },
    { label: 'Contributions',    pts: contribPts,   max: 15 },
  ]
  const weakest = breakdown.reduce((a, b) =>
    (a.pts / a.max) < (b.pts / b.max) ? a : b)
  const insightMap: Record<string, string> = {
    'Survival Rate':    `${Math.round(survivalRate * 100)}% months in surplus`,
    'Portfolio Growth': growthRatio < 1 ? 'Portfolio shrinks over time' : `Portfolio grows ${growthRatio.toFixed(1)}x`,
    'Surplus Cushion':  cushionRatio < 0 ? 'Monthly deficits detected' : 'Low monthly surplus buffer',
    'Contributions':    'Add monthly contributions',
  }
  const insight = insightMap[weakest.label] ?? ''

  return { score, label, color, insight }
}

function Speedometer({ score, color }: { score: number; color: string }) {
  // Semicircle speedometer: 180° arc from left to right
  // 0 = far left, 100 = far right
  const cx = 60, cy = 56, r = 44
  const strokeW = 9

  // Arc spans 180° (from 180° to 0° = left to right along top)
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const arcStart = 180  // leftmost point
  const arcEnd   = 0    // rightmost point

  // Full semicircle path (background track)
  const trackPath = `
    M ${cx - r},${cy}
    A ${r},${r} 0 0 1 ${cx + r},${cy}
  `

  // Colored fill arc based on score (0–100 maps to 180°–0°)
  const fillAngle = 180 - (score / 100) * 180  // degrees from left
  const fillRad   = toRad(fillAngle)
  const fillX     = cx + r * Math.cos(fillRad)
  const fillY     = cy - r * Math.sin(fillRad)
  const largeArc  = fillAngle < 90 ? 1 : 0  // large arc flag

  const fillPath = score <= 0 ? '' : score >= 100
    ? trackPath
    : `M ${cx - r},${cy} A ${r},${r} 0 ${largeArc} 1 ${fillX},${fillY}`

  // Needle: points from center to arc edge at score angle
  const needleAngle = 180 - (score / 100) * 180
  const needleRad   = toRad(needleAngle)
  const needleLen   = r - 6
  const nx = cx + needleLen * Math.cos(needleRad)
  const ny = cy - needleLen * Math.sin(needleRad)

  // Zone colors for tick marks
  const zones = [
    { label: 'Risk',   start: 0,  end: 40,  color: '#ef4444' },
    { label: 'Work',   start: 40, end: 60,  color: '#f97316' },
    { label: 'Track',  start: 60, end: 80,  color: '#eab308' },
    { label: 'Strong', start: 80, end: 100, color: '#22c55e' },
  ]

  return (
    <svg width={120} height={68} viewBox="0 0 120 68">
      {/* Zone arcs */}
      {zones.map((zone) => {
        const startAngle = 180 - (zone.start / 100) * 180
        const endAngle   = 180 - (zone.end / 100) * 180
        const sRad = toRad(startAngle)
        const eRad = toRad(endAngle)
        const sx = cx + r * Math.cos(sRad)
        const sy = cy - r * Math.sin(sRad)
        const ex = cx + r * Math.cos(eRad)
        const ey = cy - r * Math.sin(eRad)
        const la = (startAngle - endAngle) > 180 ? 1 : 0
        return (
          <path
            key={zone.label}
            d={`M ${sx},${sy} A ${r},${r} 0 ${la} 1 ${ex},${ey}`}
            fill="none"
            stroke={zone.color}
            strokeWidth={strokeW}
            opacity={0.25}
            strokeLinecap="butt"
          />
        )
      })}

      {/* Active fill arc */}
      {score > 0 && (
        <path
          d={fillPath}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeLinecap="round"
          opacity={0.9}
        />
      )}

      {/* Needle */}
      <line
        x1={cx} y1={cy}
        x2={nx} y2={ny}
        stroke="white"
        strokeWidth={2}
        strokeLinecap="round"
      />
      {/* Needle pivot */}
      <circle cx={cx} cy={cy} r={4} fill="white" />
      <circle cx={cx} cy={cy} r={2} fill="#0f172a" />

      {/* Score number */}
      <text
        x={cx} y={cy - 14}
        textAnchor="middle"
        fill="white"
        fontSize={13}
        fontWeight="bold"
        fontFamily="sans-serif"
      >
        {score}
      </text>
    </svg>
  )
}

function PlanHealthScore({ quick, sc }: { quick: QuickProjectionResponse; sc: ScenarioListItem }) {
  const { score, label, color, insight } = calcHealthScore(quick, sc)

  return (
    <div className="flex flex-col items-center">
      <Speedometer score={score} color={color} />
      <p className="font-sans text-xs font-semibold -mt-1" style={{ color }}>{label}</p>
      {insight && (
        <p className="font-sans text-slate-400 text-center mt-0.5" style={{ fontSize: 10, lineHeight: 1.3, maxWidth: 100 }}>
          {insight}
        </p>
      )}
    </div>
  )
}

// ─── Sparkline ──────────────────────────────────────────────────────────────

function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  if (values.length < 2) return null

  const [tooltip, setTooltip] = useState<{ x: number; y: number; value: number; index: number } | null>(null)

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const w = 160, h = 40, pad = 2

  const pts = values.map((v, i) => ({
    x: pad + (i / (values.length - 1)) * (w - pad * 2),
    y: h - pad - ((v - min) / range) * (h - pad * 2),
    v,
  }))

  const points   = pts.map(p => `${p.x},${p.y}`).join(' ')
  const areaPath = `M ${pts[0].x},${h - pad} ` + pts.map(p => `L ${p.x},${p.y}`).join(' ') + ` L ${pts[pts.length - 1].x},${h - pad} Z`
  const strokeColor = positive ? '#22c55e' : '#ef4444'
  const fillColor   = positive ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)'

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = (e.clientX - rect.left) * (w / rect.width)
    let closest = 0, minDist = Infinity
    pts.forEach((p, i) => { const d = Math.abs(p.x - mouseX); if (d < minDist) { minDist = d; closest = i } })
    setTooltip({ x: pts[closest].x, y: pts[closest].y, value: pts[closest].v, index: closest })
  }

  const startYear = new Date().getFullYear()

  return (
    <div className="relative inline-block">
      <svg width={w} height={h} className="opacity-90 cursor-crosshair" onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>
        <path d={areaPath} fill={fillColor} />
        <polyline points={points} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {tooltip && <circle cx={tooltip.x} cy={tooltip.y} r={3} fill={strokeColor} />}
      </svg>
      {tooltip && (
        <div
          className="absolute bottom-full mb-1 bg-slate-800 border border-violet-800 rounded px-2 py-1 text-xs font-sans text-white whitespace-nowrap pointer-events-none z-10"
          style={{ left: tooltip.x, transform: tooltip.index > values.length / 2 ? 'translateX(-100%)' : 'translateX(-50%)' }}
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
    <div className="bg-slate-900 border border-violet-900 rounded-xl p-5 hover:border-violet-800 transition-colors">
      <p className="font-sans text-white text-sm font-semibold">{sc.scenario_name}</p>

      {sc.description && (
        <p className="font-sans text-slate-400 text-xs mt-1 leading-relaxed">{sc.description}</p>
      )}

      <p className="font-sans text-slate-300 text-xs mt-2">
        {pl(sc.people_count, 'person')} · {pl(sc.income_streams_count, 'income stream')} · {pl(sc.accounts_count, 'account')}
      </p>

      {sc.income_stream_labels && sc.income_stream_labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {sc.income_stream_labels.map((t, i) => (
            <span key={i} className="font-sans text-xs bg-slate-800 text-slate-300 rounded px-1.5 py-0.5">
              {humanizeType(t)}
            </span>
          ))}
        </div>
      )}

      {sc.account_names && sc.account_names.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {sc.account_names.map((name, i) => (
            <span key={i} className="font-sans text-xs bg-slate-800/60 text-slate-400 rounded px-1.5 py-0.5 border border-violet-800/50">
              {name}
            </span>
          ))}
        </div>
      )}

      {quickQuery.isLoading && (
        <div className="mt-3 pt-3 border-t border-violet-900 space-y-2">
          <div className="h-3 w-32 bg-slate-800 rounded animate-pulse" />
          <div className="h-10 w-40 bg-slate-800 rounded animate-pulse" />
        </div>
      )}

      {quick && (
        <>
          {/* sparkline + speedometer side by side */}
          <div className="mt-3 pt-3 border-t border-violet-900 flex items-start justify-between gap-4">
            {quick.portfolio_series && quick.portfolio_series.length > 1 ? (
              <div>
                <p className="font-sans text-slate-400 text-xs mb-1.5">Portfolio over time</p>
                <Sparkline values={quick.portfolio_series} positive={positive} />
              </div>
            ) : <div />}
            <PlanHealthScore quick={quick} sc={sc} />
          </div>

          <div className="flex items-end justify-between mt-3 pt-3 border-t border-violet-900">
            <div>
              <p className="font-sans text-slate-300 text-xs">Ending Portfolio</p>
              <p className="font-sans text-white text-sm font-semibold mt-0.5">{fmt(quick.ending_portfolio)}</p>
            </div>
            <div className="text-right">
              <p className="font-sans text-slate-300 text-xs">Surplus / Deficit</p>
              <p className={`font-sans text-sm font-semibold mt-0.5 ${quick.financial_summary.total_surplus_deficit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {quick.financial_summary.total_surplus_deficit >= 0 ? '' : '−'}
                {fmt(quick.financial_summary.total_surplus_deficit)}
              </p>
            </div>
          </div>
        </>
      )}

      {/* primary actions */}
      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-violet-900">
        <Link
          to={`/scenarios/${sc.scenario_id}`}
          className="font-sans text-slate-300 hover:text-white text-xs border border-violet-800 hover:border-violet-600 px-3 py-1.5 rounded-lg transition-colors"
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
          {dupStatus === 'loading' ? 'Duplicating…' : dupStatus === 'done' ? '✓ Duplicated' : dupStatus === 'error' ? '✗ Failed' : 'Duplicate'}
        </button>
        <button onClick={() => onExport(sc.scenario_id)} className="font-sans text-slate-400 hover:text-gold-400 text-xs transition-colors">
          Export JSON
        </button>
        <button onClick={() => onDelete(sc.scenario_id, sc.scenario_name)} className="font-sans text-slate-400 hover:text-red-400 text-xs transition-colors">
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

  const [dupStatus,    setDupStatus]    = useState<Record<string, 'loading' | 'done' | 'error'>>({})
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')

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
      await client.post('/scenarios', { ...original, scenario_id: newId, scenario_name: `${name} (copy)` })
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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const scenario = await importScenarioFromFile(file)
      await client.post('/scenarios', { ...scenario, scenario_id: crypto.randomUUID() })
      await qc.invalidateQueries({ queryKey: qk.scenarios() })
      setImportStatus('success')
      setTimeout(() => setImportStatus('idle'), 3000)
    } catch {
      setImportStatus('error')
      setTimeout(() => setImportStatus('idle'), 3000)
    }
    e.target.value = ''
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

          <div className="flex items-center gap-3">
            <label className="cursor-pointer font-sans text-slate-300 hover:text-gold-400 text-sm border border-violet-800 hover:border-gold-600 px-4 py-2 rounded-lg transition-colors duration-150">
              {importStatus === 'success' ? '✓ Imported' : importStatus === 'error' ? '✗ Failed' : '↑ Import JSON'}
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>

            {scenarios.length > 1 && (
              <Link to="/scenarios/compare" className="font-sans text-slate-300 hover:text-gold-400 text-sm border border-violet-800 hover:border-gold-600 px-4 py-2 rounded-lg transition-colors duration-150">
                Compare →
              </Link>
            )}

            <Link
              to="/scenarios/new"
              className="inline-flex items-center gap-2 bg-gold-600 hover:bg-gold-500 text-slate-950 font-sans font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors duration-150"
            >
              <span className="text-lg leading-none">+</span>
              New Scenario
            </Link>
          </div>
        </div>

        {/* scenario cards */}
        <div>
          <h2 className="font-sans text-white text-sm font-semibold mb-3">
            Your {scenarios.length} Scenario{scenarios.length !== 1 ? 's' : ''}
          </h2>

          {scenarios.length === 0 ? (
            <div className="bg-slate-900 border border-violet-900 rounded-xl px-6 py-16 text-center">
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
