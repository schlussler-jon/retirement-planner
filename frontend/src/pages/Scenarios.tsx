/**
 * Scenarios – list page
 */

import { useState } from 'react'
import { Link }     from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useScenarios, useDeleteScenario, qk } from '@/api/hooks'
import client from '@/api/client'
import type { Scenario } from '@/types/scenario'
import {
  exportScenarioAsFile,
  importScenarioFromFile,
  saveScenarioToStorage
} from '@/utils/storage'

export default function Scenarios() {
  const scenariosQuery = useScenarios()
  const deleteMut      = useDeleteScenario()
  const qc             = useQueryClient()
  const scenarios      = scenariosQuery.data?.scenarios ?? []

  const [dupStatus,  setDupStatus]  = useState<Record<string, 'loading' | 'done' | 'error'>>({})
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')

  // Sort scenarios alphabetically
  const sortedScenarios = [...scenarios].sort((a, b) =>
    a.scenario_name.localeCompare(b.scenario_name)
  )

  // ── helpers ───────────────────────────────────────────────────────────
  const clearDup = (id: string, ms = 2500) => {
    setTimeout(() => setDupStatus(prev => { const n = { ...prev }; delete n[id]; return n }), ms)
  }

  // ── handlers ──────────────────────────────────────────────────────────
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    await deleteMut.mutateAsync(id)
  }

  const handleDuplicate = async (id: string, name: string) => {
    setDupStatus(prev => ({ ...prev, [id]: 'loading' }))
    try {
      const { data: original } = await client.get<Scenario>(`/scenarios/${id}`)

      // pick a unique ID: id-copy, id-copy-2, id-copy-3 …
      const existingIds = new Set(scenarios.map(s => s.scenario_id))
      const newId = crypto.randomUUID()  // replace the existingIds/while loop block
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
      // Assign a fresh ID so it never conflicts with the original
      const imported = { ...scenario, scenario_id: crypto.randomUUID() }
      
      // Load to backend so it can be edited
      await client.post('/scenarios', scenario)
      await qc.invalidateQueries({ queryKey: qk.scenarios() })
      
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

  // ── render ────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">

      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl text-white">Scenarios</h1>
          <p className="font-sans text-slate-300 text-sm mt-1">
            Manage your retirement planning scenarios.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Import button */}
          <label className="
            cursor-pointer font-sans text-slate-300 hover:text-gold-400 text-sm
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

      {/* list card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {sortedScenarios.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-sans text-slate-400 text-sm">
              No scenarios yet.{' '}
              <Link to="/scenarios/new" className="text-gold-500 hover:text-gold-400 transition-colors">
                Create your first one
              </Link>
              {' '}or import a JSON file.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {sortedScenarios.map((sc) => (
              <li key={sc.scenario_id}
                className="px-6 py-5 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                {/* left: name + id */}
                <div>
                  <p className="font-sans text-white text-sm font-medium">{sc.scenario_name}</p>
                  <p className="font-sans text-slate-300 text-xs mt-1">
                    {sc.people_count} people · {sc.income_streams_count} income streams · {sc.accounts_count} accounts
                  </p>
                </div>
                {/* right: actions */}
                <div className="flex items-center gap-3 shrink-0">
                  <Link to={`/scenarios/${sc.scenario_id}`}
                    className="font-sans text-slate-300 hover:text-gold-400 text-xs transition-colors">
                    Open →
                  </Link>
                  <Link to={`/scenarios/${sc.scenario_id}/results`}
                    className="font-sans text-slate-300 hover:text-gold-400 text-xs transition-colors">
                    View Results →
                  </Link>
                  <button
                    onClick={() => handleDuplicate(sc.scenario_id, sc.scenario_name)}
                    className="font-sans text-slate-300 hover:text-gold-400 text-xs transition-colors">
                    Duplicate
                  </button>
                  <button
                    onClick={() => handleExport(sc)}
                    className="font-sans text-slate-300 hover:text-gold-400 text-xs transition-colors">
                    Export JSON
                  </button>
                  <button
                    onClick={() => handleDelete(sc.scenario_id, sc.scenario_name)}
                    className="font-sans text-slate-400 hover:text-danger text-xs transition-colors">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}