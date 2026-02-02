/**
 * DrivePanel
 *
 * Renders inside the Scenarios page when the "Google Drive" tab is active.
 *
 * Lists every scenario the user has saved to Drive, cross-references against
 * the in-memory list to show a sync badge, and provides Load / Delete actions.
 *
 * Sync badges:
 *   Synced      – scenario_id exists in both memory and Drive
 *   Drive Only  – scenario_id exists only on Drive
 *
 * Load behaviour:
 *   • Drive Only  → creates the scenario in memory (POST)
 *   • Synced      → overwrites the in-memory copy   (PUT)
 */

import { useState } from 'react'
import {
  useDriveScenarios,
  useLoadFromDrive,
  useDeleteFromDrive,
  useCreateScenario,
  useUpdateScenario,
} from '@/api/hooks'
import type { ScenarioListItem } from '@/types/api'

interface Props {
  memoryScenarios: ScenarioListItem[]
}

type RowState = 'loading' | 'loaded' | 'error' | 'deleted'

export default function DrivePanel({ memoryScenarios }: Props) {
  const driveQuery = useDriveScenarios()
  const loadMut    = useLoadFromDrive()
  const deleteMut  = useDeleteFromDrive()
  const createMut  = useCreateScenario()
  const updateMut  = useUpdateScenario()

  const [rowStatus, setRowStatus] = useState<Record<string, RowState>>({})

  const driveScenarios = driveQuery.data?.scenarios ?? []
  const memoryIds      = new Set(memoryScenarios.map(s => s.scenario_id))

  // ── helpers ───────────────────────────────────────────────────────────
  const clearAfter = (id: string, ms = 2500) => {
    setTimeout(() => setRowStatus(prev => { const n = { ...prev }; delete n[id]; return n }), ms)
  }

  // ── handlers ──────────────────────────────────────────────────────────
  const handleLoad = async (scenarioId: string) => {
    setRowStatus(prev => ({ ...prev, [scenarioId]: 'loading' }))
    try {
      const scenario = await loadMut.mutateAsync(scenarioId)
      if (memoryIds.has(scenarioId)) {
        await updateMut.mutateAsync(scenario)   // overwrite existing
      } else {
        await createMut.mutateAsync(scenario)   // new in memory
      }
      setRowStatus(prev => ({ ...prev, [scenarioId]: 'loaded' }))
      clearAfter(scenarioId)
    } catch {
      setRowStatus(prev => ({ ...prev, [scenarioId]: 'error' }))
      clearAfter(scenarioId, 3000)
    }
  }

  const handleDelete = async (scenarioId: string) => {
    if (!window.confirm(
      'Remove this scenario from Google Drive?\n\nYour in-memory copy (if any) is not affected.'
    )) return
    setRowStatus(prev => ({ ...prev, [scenarioId]: 'loading' }))
    try {
      await deleteMut.mutateAsync(scenarioId)
      setRowStatus(prev => ({ ...prev, [scenarioId]: 'deleted' }))
      // hook's onSuccess invalidates driveScenarios query; row disappears on next render
    } catch {
      setRowStatus(prev => ({ ...prev, [scenarioId]: 'error' }))
      clearAfter(scenarioId, 3000)
    }
  }

  // ── loading ───────────────────────────────────────────────────────────
  if (driveQuery.isLoading) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="font-sans text-slate-500 text-sm animate-pulse-slow">Checking Google Drive…</p>
      </div>
    )
  }

  // ── error ─────────────────────────────────────────────────────────────
  if (driveQuery.isError) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="font-sans text-danger text-sm">Could not reach Google Drive.</p>
        <button onClick={() => driveQuery.refetch()}
          className="font-sans text-gold-500 hover:text-gold-400 text-xs mt-2 transition-colors">
          Try again →
        </button>
      </div>
    )
  }

  // ── empty ─────────────────────────────────────────────────────────────
  if (driveScenarios.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="font-sans text-slate-600 text-sm">Nothing saved to Drive yet.</p>
        <p className="font-sans text-slate-600 text-xs mt-1">
          Use <span className="text-slate-400">"Save to Drive"</span> in the scenario editor to back up a scenario.
        </p>
      </div>
    )
  }

  // ── list ──────────────────────────────────────────────────────────────
  return (
    <ul className="divide-y divide-slate-800">
      {driveScenarios.map((ds) => {
        const st       = rowStatus[ds.scenario_id]
        const inMemory = memoryIds.has(ds.scenario_id)

        // hide rows that were just deleted (until query refetch removes them)
        if (st === 'deleted') return null

        return (
          <li key={ds.scenario_id}
            className="px-6 py-5 flex items-center justify-between hover:bg-slate-800/30 transition-colors">

            {/* left: id + badge + meta */}
            <div>
              <div className="flex items-center gap-2">
                <p className="font-sans text-white text-sm font-medium">{ds.scenario_id}</p>
                <span className={`font-sans text-xs px-2 py-0.5 rounded-full ${
                  inMemory
                    ? 'bg-success/10 text-success'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {inMemory ? 'Synced' : 'Drive Only'}
                </span>
              </div>
              <p className="font-sans text-slate-600 text-xs mt-1">
                {ds.modified_time
                  ? `Modified ${new Date(ds.modified_time).toLocaleDateString()}`
                  : 'No date info'}
                {ds.size ? ` · ${Number(ds.size).toLocaleString()} bytes` : ''}
              </p>
            </div>

            {/* right: feedback + actions */}
            <div className="flex items-center gap-3 shrink-0">
              {st === 'loaded' && <span className="font-sans text-success text-xs">✓ Loaded</span>}
              {st === 'error'  && <span className="font-sans text-danger  text-xs">Failed</span>}

              {/* Load – hidden after a successful load */}
              {st !== 'loaded' && (
                <button
                  onClick={() => handleLoad(ds.scenario_id)}
                  disabled={st === 'loading'}
                  className="font-sans text-slate-500 hover:text-gold-400 disabled:text-slate-700 disabled:cursor-not-allowed text-xs transition-colors"
                >
                  {st === 'loading' ? '…' : 'Load'}
                </button>
              )}

              {/* Delete */}
              <button
                onClick={() => handleDelete(ds.scenario_id)}
                disabled={st === 'loading'}
                className="font-sans text-slate-600 hover:text-danger disabled:text-slate-700 disabled:cursor-not-allowed text-xs transition-colors"
              >
                {st === 'loading' ? '…' : 'Delete'}
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
