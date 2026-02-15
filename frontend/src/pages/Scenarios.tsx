/**
 * Scenarios – list page
 *
 * Three-tab layout:
 *   LocalStorage – scenarios saved in browser (persists across refreshes)
 *   In Memory    – scenarios in backend memory (lost on restart)
 *   Google Drive – scenarios saved to Drive
 */

import { useState, useEffect } from 'react'
import { Link }     from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useScenarios, useDeleteScenario, qk } from '@/api/hooks'
import client from '@/api/client'
import type { Scenario } from '@/types/scenario'
import DrivePanel from '@/components/DrivePanel'
import {
  loadScenariosFromStorage,
  deleteScenarioFromStorage,
  exportScenarioAsFile,
  importScenarioFromFile,
  saveScenarioToStorage
} from '@/utils/storage'

export default function Scenarios() {
  const scenariosQuery = useScenarios()
  const deleteMut      = useDeleteScenario()
  const qc             = useQueryClient()
  const scenarios      = scenariosQuery.data?.scenarios ?? []

  const [activeTab,  setActiveTab]  = useState<'local' | 'memory'>('local')
  const [dupStatus,  setDupStatus]  = useState<Record<string, 'loading' | 'done' | 'error'>>({})
  const [localScenarios, setLocalScenarios] = useState<Scenario[]>([])
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')

  // Load localStorage scenarios on mount
  useEffect(() => {
    setLocalScenarios(loadScenariosFromStorage())
  }, [])

  // ── sorted alphabetically ─────────────────────────────────────────────
  const sortedMemory = [...scenarios].sort((a, b) =>
    a.scenario_name.localeCompare(b.scenario_name)
  )
  const sortedLocal = [...localScenarios].sort((a, b) =>
    a.scenario_name.localeCompare(b.scenario_name)
  )

  // ── helpers ───────────────────────────────────────────────────────────
  const clearDup = (id: string, ms = 2500) => {
    setTimeout(() => setDupStatus(prev => { const n = { ...prev }; delete n[id]; return n }), ms)
  }

  const refreshLocal = () => setLocalScenarios(loadScenariosFromStorage())

  // ── handlers ──────────────────────────────────────────────────────────
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    await deleteMut.mutateAsync(id)
  }

  const handleDeleteLocal = (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}" from local storage?`)) return
    deleteScenarioFromStorage(id)
    refreshLocal()
  }

  const handleDuplicate = async (id: string, name: string) => {
    setDupStatus(prev => ({ ...prev, [id]: 'loading' }))
    try {
      const { data: original } = await client.get<Scenario>(`/scenarios/${id}`)

      // pick a unique ID: id-copy, id-copy-2, id-copy-3 …
      const existingIds = new Set(scenarios.map(s => s.scenario_id))
      let newId = `${id}-copy`
      let n = 2
      while (existingIds.has(newId)) { newId = `${id}-copy-${n}`; n++ }

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

  const handleExport = (scenario: Scenario) => {
    exportScenarioAsFile(scenario)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const scenario = await importScenarioFromFile(file)
      saveScenarioToStorage(scenario)
      refreshLocal()
      setImportStatus('success')
      setTimeout(() => setImportStatus('idle'), 3000)
    } catch (error) {
      console.error('Import failed:', error)
      setImportStatus('error')
      setTimeout(() => setImportStatus('idle'), 3000)
    }

    // Reset file input
    e.target.value = ''
  }

  const handleLoadToMemory = async (scenario: Scenario) => {
    try {
      await client.post('/scenarios', scenario)
      await qc.invalidateQueries({ queryKey: qk.scenarios() })
      alert(`"${scenario.scenario_name}" loaded to memory!`)
    } catch (error) {
      console.error('Failed to load to memory:', error)
      alert('Failed to load scenario to memory')
    }
  }

  // ── render ────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">

      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl text-white">Scenarios</h1>
          <p className="font-sans text-slate-500 text-sm mt-1">
            Manage your retirement planning scenarios.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Import button */}
          <label className="
            cursor-pointer font-sans text-slate-500 hover:text-gold-400 text-sm
            border border-slate-700 hover:border-gold-600 px-4 py-2 rounded-lg
            transition-colors duration-150
          ">
            {importStatus === 'success' ? '✓ Imported' : importStatus === 'error' ? '✗ Failed' : '↑ Import JSON'}
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          
          <Link to="/scenarios/compare"
            className="font-sans text-gold-500 hover:text-gold-400 text-sm transition-colors">
            Compare →
          </Link>
          <Link to="/scenarios/new"
            className="
              inline-flex items-center gap-2
              bg-gold-600 hover:bg-gold-500
              text-slate-950 font-sans font-semibold text-sm
              px-5 py-2.5 rounded-lg
              transition-colors duration-150
            ">
            <span className="text-lg leading-none">+</span>
            New Scenario
          </Link>
        </div>
      </div>

      {/* tab strip */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 mb-4">
        {(['local', 'memory'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`
              flex-1 font-sans text-xs font-semibold px-3 py-2 rounded-lg
              transition-colors duration-150
              ${activeTab === tab
                ? 'bg-slate-800 text-gold-500'
                : 'text-slate-500 hover:text-slate-300'
              }
            `}>
            {tab === 'local' ? 'LocalStorage' : 'In Memory'}
          </button>
        ))}
      </div>

      {/* list card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">

        {/* ── LocalStorage tab ── */}
        {activeTab === 'local' && (
          sortedLocal.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="font-sans text-slate-600 text-sm">
                No scenarios in local storage yet.{' '}
                <Link to="/scenarios/new" className="text-gold-500 hover:text-gold-400 transition-colors">
                  Create your first one
                </Link>
                {' '}or import a JSON file.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {sortedLocal.map((sc) => (
                <li key={sc.scenario_id}
                  className="px-6 py-5 flex items-center justify-between hover:bg-slate-800/30 transition-colors">

                  {/* left: name + id */}
                  <div>
                    <p className="font-sans text-white text-sm font-medium">{sc.scenario_name}</p>
                    <p className="font-sans text-slate-600 text-xs mt-0.5 font-mono">{sc.scenario_id}</p>
                    <p className="font-sans text-slate-500 text-xs mt-1">
                      {sc.people.length} people · {sc.income_streams.length} income streams · {sc.accounts.length} accounts
                    </p>
                  </div>

                  {/* right: actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    <Link to={`/scenarios/${sc.scenario_id}`}
                      className="font-sans text-slate-500 hover:text-gold-400 text-xs transition-colors">
                      Open →
                    </Link>
                    <button
                      onClick={() => handleLoadToMemory(sc)}
                      className="font-sans text-slate-500 hover:text-gold-400 text-xs transition-colors">
                      Load to Memory
                    </button>
                    <button
                      onClick={() => handleExport(sc)}
                      className="font-sans text-slate-500 hover:text-gold-400 text-xs transition-colors">
                      Export JSON
                    </button>
                    <button
                      onClick={() => handleDeleteLocal(sc.scenario_id, sc.scenario_name)}
                      className="font-sans text-slate-600 hover:text-danger text-xs transition-colors">
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}

        {/* ── In Memory tab ── */}
        {activeTab === 'memory' && (
          sortedMemory.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="font-sans text-slate-600 text-sm">
                No scenarios yet.{' '}
                <Link to="/scenarios/new" className="text-gold-500 hover:text-gold-400 transition-colors">
                  Create your first one
                </Link>
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {sortedMemory.map((sc) => {
                const ds = dupStatus[sc.scenario_id]
                return (
                  <li key={sc.scenario_id}
                    className="px-6 py-5 flex items-center justify-between hover:bg-slate-800/30 transition-colors">

                    {/* left: name + id + counts */}
                    <div>
                      <p className="font-sans text-white text-sm font-medium">{sc.scenario_name}</p>
                      <p className="font-sans text-slate-600 text-xs mt-0.5 font-mono">{sc.scenario_id}</p>
                      <p className="font-sans text-slate-500 text-xs mt-1">
                        {sc.people_count} people · {sc.income_streams_count} income streams · {sc.accounts_count} accounts
                      </p>
                    </div>

                    {/* right: feedback + actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      {ds === 'done'  && <span className="font-sans text-success text-xs">✓ Duplicated</span>}
                      {ds === 'error' && <span className="font-sans text-danger  text-xs">Failed</span>}

                      <Link to={`/scenarios/${sc.scenario_id}`}
                        className="font-sans text-slate-500 hover:text-gold-400 text-xs transition-colors">
                        Open →
                      </Link>
                      <Link to={`/scenarios/${sc.scenario_id}/results`}
                        className="font-sans text-slate-500 hover:text-gold-400 text-xs transition-colors">
                        Run →
                      </Link>
                      <button
                        onClick={() => handleDuplicate(sc.scenario_id, sc.scenario_name)}
                        disabled={ds === 'loading'}
                        className="font-sans text-slate-500 hover:text-gold-400 disabled:text-slate-700 disabled:cursor-not-allowed text-xs transition-colors">
                        {ds === 'loading' ? '…' : 'Duplicate'}
                      </button>
                      <button
                        onClick={() => handleDelete(sc.scenario_id, sc.scenario_name)}
                        className="font-sans text-slate-600 hover:text-danger text-xs transition-colors">
                        Delete
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )
        )}

      </div>
    </div>
  )
}
