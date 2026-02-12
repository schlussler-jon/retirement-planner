/**
 * ScenarioEditor
 *
 * Dual-mode page:
 *   /scenarios/new  → POST (create)
 *   /scenarios/:id  → PUT  (edit)   + "View Results" link
 *
 * All state lives in a single `scenario` object.  Each tab receives its
 * slice plus an onChange; nothing hits the API until the user clicks Save.
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQueryClient }                                                      from '@tanstack/react-query'
import { useScenario, useCreateScenario, useUpdateScenario, useSaveToDrive, useScenarios, useValidateScenario, qk } from '@/api/hooks'
import { saveScenarioToStorage, exportScenarioAsFile } from '@/utils/storage'
import client                                                                   from '@/api/client'
import type { Scenario, GlobalSettings, Person, IncomeStream, InvestmentAccount, BudgetSettings, TaxSettings } from '@/types/scenario'

import GlobalSettingsTab from '@/components/editor/GlobalSettingsTab'
import PeopleTab         from '@/components/editor/PeopleTab'
import IncomeTab         from '@/components/editor/IncomeTab'
import AccountsTab       from '@/components/editor/AccountsTab'
import BudgetTab         from '@/components/editor/BudgetTab'
import TaxTab            from '@/components/editor/TaxTab'

// ─── constants ────────────────────────────────────────────────────────────

const TABS = ['Settings', 'People', 'Income', 'Accounts', 'Budget', 'Tax'] as const
type Tab = typeof TABS[number]

// ─── helpers ──────────────────────────────────────────────────────────────

function emptyScenario(): Scenario {
  return {
    scenario_id: '',
    scenario_name: '',
    description: '',
    global_settings: {
      projection_start_month: '2026-01',
      projection_end_year: 2056,
      residence_state: 'AZ',
    },
    people: [],
    income_streams: [],
    accounts: [],
    budget_settings: {
      categories: [],
      inflation_annual_percent: 0.025,
      survivor_flexible_reduction_percent: 0,
      survivor_reduction_mode: 'flex_only',
    },
    tax_settings: {
      filing_status: 'single',
      standard_deduction_override: null,
      tax_year_ruleset: 2024,
    },
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

function tabBadge(s: Scenario, tab: Tab): number | null {
  const map: Partial<Record<Tab, number>> = {
    People:   s.people.length,
    Income:   s.income_streams.length,
    Accounts: s.accounts.length,
    Budget:   s.budget_settings.categories.length,
  }
  const n = map[tab]
  return n ? n : null
}

// ─── component ────────────────────────────────────────────────────────────

export default function ScenarioEditor() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew    = !id

  const scenarioQuery  = useScenario(id ?? '', !isNew)
  const createMut      = useCreateScenario()
  const updateMut      = useUpdateScenario()
  const saveDriveMut   = useSaveToDrive()
  const validateMut    = useValidateScenario()
  const scenariosQuery = useScenarios()
  const qc             = useQueryClient()

  const [scenario,           setScenario]           = useState<Scenario>(emptyScenario)
  const [activeTab,          setActiveTab]          = useState<Tab>('Settings')
  const [saving,             setSaving]             = useState(false)
  const [saved,              setSaved]              = useState(false)
  const [error,              setError]              = useState<string | null>(null)
  const [idTouched,          setIdTouched]          = useState(false)
  const [driveSaving,        setDriveSaving]        = useState(false)
  const [driveSaved,         setDriveSaved]         = useState(false)
  const [dupLoading,         setDupLoading]         = useState(false)
  const [validating,         setValidating]         = useState(false)
  const [validationErrors,   setValidationErrors]   = useState<string[]>([])
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])
  const [validationPassed,   setValidationPassed]   = useState(false)

  // ── populate when editing ───────────────────────────────────────────
  useEffect(() => {
    if (scenarioQuery.data) {
      setScenario(scenarioQuery.data)
      setIdTouched(true)
    }
  }, [scenarioQuery.data])

  // ── auto-generate ID from name ──────────────────────────────────────
  useEffect(() => {
    if (isNew && !idTouched) {
      setScenario(prev => ({
        ...prev,
        scenario_id: prev.scenario_name ? slugify(prev.scenario_name) : '',
      }))
    }
  }, [scenario.scenario_name, isNew, idTouched])

  // ── save ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setError(null)
    setSaved(false)
    setSaving(true)
    try {
      if (isNew) {
        await createMut.mutateAsync(scenario)
        navigate(`/scenarios/${scenario.scenario_id}`)
      } else {
        await updateMut.mutateAsync(scenario)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'An unexpected error occurred.')
    } finally {
      setSaving(false)
    }
  }

  // ── save to drive ──────────────────────────────────────────────────────
  const handleSaveToDrive = async () => {
    setError(null)
    setDriveSaved(false)
    setDriveSaving(true)
    try {
      await saveDriveMut.mutateAsync(scenario)
      setDriveSaved(true)
      setTimeout(() => setDriveSaved(false), 3000)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to save to Google Drive.')
    } finally {
      setDriveSaving(false)
    }
  }

  const handleSaveToLocal = () => {
    saveScenarioToStorage(scenario)
    alert(`"${scenario.scenario_name}" saved to LocalStorage!`)
  }

  const handleExportJSON = () => {
    exportScenarioAsFile(scenario)
  }

  // ── duplicate ───────────────────────────────────────────────────────────
  const handleDuplicate = async () => {
    setError(null)
    setDupLoading(true)
    try {
      const existingIds = new Set(
        (scenariosQuery.data?.scenarios ?? []).map(s => s.scenario_id)
      )
      let newId = `${scenario.scenario_id}-copy`
      let n = 2
      while (existingIds.has(newId)) { newId = `${scenario.scenario_id}-copy-${n}`; n++ }

      await client.post('/scenarios', {
        ...scenario,
        scenario_id:   newId,
        scenario_name: `${scenario.scenario_name} (copy)`,
      })
      await qc.invalidateQueries({ queryKey: qk.scenarios() })
      navigate(`/scenarios/${newId}`)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to duplicate scenario.')
    } finally {
      setDupLoading(false)
    }
  }

  // ── validate ───────────────────────────────────────────────────────────
  const handleValidate = async () => {
    setValidationErrors([])
    setValidationWarnings([])
    setValidationPassed(false)
    setValidating(true)
    try {
      const result = await validateMut.mutateAsync(scenario)
      setValidationErrors(result.errors ?? [])
      setValidationWarnings(result.warnings ?? [])
      if (result.valid && !result.errors?.length && !result.warnings?.length) {
        setValidationPassed(true)
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Validation request failed.')
    } finally {
      setValidating(false)
    }
  }

  // ── loading / error for existing scenario ──────────────────────────
  if (!isNew && scenarioQuery.isLoading) {
    return (
      <div className="animate-fade-in flex items-center justify-center h-64">
        <p className="font-sans text-slate-500 text-sm">Loading scenario…</p>
      </div>
    )
  }
  if (!isNew && scenarioQuery.isError) {
    return (
      <div className="animate-fade-in">
        <p className="font-sans text-danger text-sm">Scenario not found.</p>
        <a href="/scenarios" className="font-sans text-gold-500 hover:text-gold-400 text-sm mt-2 inline-block">← Back to scenarios</a>
      </div>
    )
  }

  // ── render ──────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in max-w-4xl">

      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl text-white">
            {isNew ? 'New Scenario' : 'Edit Scenario'}
          </h1>
          <p className="font-sans text-slate-500 text-sm mt-1">
            {isNew
              ? 'Fill in the details below, then click Create.'
              : `Editing "${scenario.scenario_name}"`}
          </p>
        </div>

        {/* action buttons */}
        <div className="flex items-center gap-3">
          {/* View Results – edit mode only, red dot when validation errors exist */}
          {!isNew && (
            <span className="relative inline-flex items-center">
              <Link
                to={`/scenarios/${scenario.scenario_id}/results`}
                className="font-sans text-gold-500 hover:text-gold-400 text-sm transition-colors"
              >
                View Results →
              </Link>
              {validationErrors.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-danger"></span>
              )}
            </span>
          )}

          {/* Save to Drive – edit mode only */}
          {!isNew && (
            <button
              onClick={handleSaveToDrive}
              disabled={driveSaving}
              className="font-sans text-slate-500 hover:text-gold-400 disabled:text-slate-700 disabled:cursor-not-allowed text-sm transition-colors"
            >
              {driveSaving ? '☁ Saving…' : '☁ Save to Drive'}
            </button>
          )}

          {/* Save to LocalStorage */}
          {!isNew && (
            <button
              onClick={handleSaveToLocal}
              className="font-sans text-slate-500 hover:text-gold-400 text-sm transition-colors"
            >
              💾 Save to LocalStorage
            </button>
          )}

          {/* Export JSON */}
          {!isNew && (
            <button
              onClick={handleExportJSON}
              className="font-sans text-slate-500 hover:text-gold-400 text-sm transition-colors"
            >
              ↓ Export JSON
            </button>
          )}

          {/* Duplicate – edit mode only */}
          {!isNew && (
            <button
              onClick={handleDuplicate}
              disabled={dupLoading}
              className="font-sans text-slate-500 hover:text-gold-400 disabled:text-slate-700 disabled:cursor-not-allowed text-sm transition-colors"
            >
              {dupLoading ? '⧉ …' : '⧉ Duplicate'}
            </button>
          )}

          {/* Validate – edit mode only */}
          {!isNew && (
            <button
              onClick={handleValidate}
              disabled={validating}
              className="font-sans text-slate-500 hover:text-gold-400 disabled:text-slate-700 disabled:cursor-not-allowed text-sm transition-colors"
            >
              {validating ? '✓ …' : '✓ Validate'}
            </button>
          )}

          {/* Save / Create */}
          <button
            onClick={handleSave}
            disabled={saving || !scenario.scenario_name || !scenario.scenario_id}
            className="
              inline-flex items-center justify-center
              bg-gold-600 hover:bg-gold-500
              disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed
              text-slate-950 font-sans font-semibold text-sm
              px-6 py-2.5 rounded-lg
              transition-colors duration-150
            "
          >
            {saving ? 'Saving…' : isNew ? 'Create Scenario' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* banners */}
      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 mb-4">
          <p className="font-sans text-danger text-sm">{error}</p>
        </div>
      )}
      {saved && (
        <div className="bg-success/10 border border-success/30 rounded-lg px-4 py-3 mb-4">
          <p className="font-sans text-success text-sm">✓ Changes saved successfully.</p>
        </div>
      )}
      {driveSaved && (
        <div className="bg-success/10 border border-success/30 rounded-lg px-4 py-3 mb-4">
          <p className="font-sans text-success text-sm">✓ Saved to Google Drive.</p>
        </div>
      )}
      {validationPassed && (
        <div className="bg-success/10 border border-success/30 rounded-lg px-4 py-3 mb-4">
          <p className="font-sans text-success text-sm">✓ Scenario is valid — ready to run.</p>
        </div>
      )}
      {validationErrors.length > 0 && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 mb-4">
          <p className="font-sans text-danger text-xs font-semibold uppercase tracking-wider mb-2">Validation Errors</p>
          {validationErrors.map((err, i) => (
            <p key={i} className="font-sans text-danger text-sm">· {err}</p>
          ))}
        </div>
      )}
      {validationWarnings.length > 0 && (
        <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg px-4 py-3 mb-4">
          <p className="font-sans text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">Warnings</p>
          {validationWarnings.map((warn, i) => (
            <p key={i} className="font-sans text-amber-400 text-sm">· {warn}</p>
          ))}
        </div>
      )}

      {/* name / id / description */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Scenario Name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={scenario.scenario_name}
              onChange={e => setScenario(prev => ({ ...prev, scenario_name: e.target.value }))}
              placeholder="e.g. Base Retirement Plan"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm placeholder-slate-600"
            />
          </div>
          <div>
            <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Scenario ID <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={scenario.scenario_id}
              onChange={e => { setIdTouched(true); setScenario(prev => ({ ...prev, scenario_id: e.target.value })) }}
              placeholder="auto-generated from name"
              disabled={!isNew}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm placeholder-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="font-sans text-slate-600 text-xs mt-1">
              {isNew ? 'Auto-fills as you type the name.' : 'Cannot be changed after creation.'}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
            Description
          </label>
          <textarea
            value={scenario.description}
            onChange={e => setScenario(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Optional notes about this scenario…"
            rows={2}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm placeholder-slate-600 resize-none"
          />
        </div>
      </div>

      {/* tab strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 mb-4">
        {TABS.map(tab => {
          const badge = tabBadge(scenario, tab)
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                font-sans text-xs font-semibold px-2 py-2 rounded-lg
                transition-colors duration-150 whitespace-nowrap
                ${activeTab === tab
                  ? 'bg-slate-800 text-gold-500'
                  : 'text-slate-500 hover:text-slate-300'
                }
              `}
            >
              {tab}
              {badge !== null && (
                <span className={`ml-1 ${activeTab === tab ? 'text-gold-600' : 'text-slate-600'}`}>
                  ({badge})
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* tab content */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        {activeTab === 'Settings'  && <GlobalSettingsTab settings={scenario.global_settings}   onChange={v => setScenario(prev => ({ ...prev, global_settings: v }))}  />}
        {activeTab === 'People'    && <PeopleTab    people={scenario.people}                    onChange={v => setScenario(prev => ({ ...prev, people: v }))}           />}
        {activeTab === 'Income'    && <IncomeTab    streams={scenario.income_streams} people={scenario.people} onChange={v => setScenario(prev => ({ ...prev, income_streams: v }))} />}
        {activeTab === 'Accounts'  && <AccountsTab  accounts={scenario.accounts}                onChange={v => setScenario(prev => ({ ...prev, accounts: v }))}        />}
        {activeTab === 'Budget'    && <BudgetTab    budget={scenario.budget_settings}           onChange={v => setScenario(prev => ({ ...prev, budget_settings: v }))} />}
        {activeTab === 'Tax'       && <TaxTab       tax={scenario.tax_settings}                 onChange={v => setScenario(prev => ({ ...prev, tax_settings: v }))}    />}
      </div>
    </div>
  )
}
