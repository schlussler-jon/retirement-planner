/**
 * ScenarioEditor
 *
 * Dual-mode page:
 *   /scenarios/new  → POST (create)
 *   /scenarios/:id  → PUT  (edit)
 *
 * Features a step-by-step progress tracker and "What's Next" guidance
 * so users always know what to do and how far along they are.
 */

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useScenario, useCreateScenario, useUpdateScenario, useValidateScenario, qk } from '@/api/hooks'
import { saveScenarioToStorage, exportScenarioAsFile } from '@/utils/storage'
import client from '@/api/client'
import { parseValidationError } from '@/utils/errorParser'
import type { Scenario } from '@/types/scenario'

import PeopleTab         from '@/components/editor/PeopleTab'
import IncomeTab         from '@/components/editor/IncomeTab'
import AccountsTab       from '@/components/editor/AccountsTab'
import BudgetTab         from '@/components/editor/BudgetTab'
import TaxTab            from '@/components/editor/TaxTab'
import GlobalSettingsTab from '@/components/editor/GlobalSettingsTab'

// ─── types ────────────────────────────────────────────────────────────────

const TABS = ['People', 'Income', 'Accounts', 'Budget', 'Tax', 'Settings'] as const
type Tab = typeof TABS[number]

interface StepConfig {
  tab: Tab
  label: string
  subtitle: string
  emptyPrompt: string     // shown in "What's Next" when this step is incomplete
  emptyAction: string     // CTA label
  count: (s: Scenario) => number
  isComplete: (s: Scenario) => boolean
  isRequired: boolean
}

// ─── step definitions ─────────────────────────────────────────────────────

const STEPS: StepConfig[] = [
  {
    tab: 'People',
    label: 'People',
    subtitle: 'Who is in this plan',
    emptyPrompt: 'Start by adding the people in this retirement plan — yourself, and your spouse or partner if applicable.',
    emptyAction: 'Add a Person',
    count: s => s.people.length,
    isComplete: s => s.people.length > 0,
    isRequired: true,
  },
  {
    tab: 'Income',
    label: 'Income',
    subtitle: 'Salary, pension, Social Security',
    emptyPrompt: 'Add your income streams — salary, pension, Social Security, or any other recurring income.',
    emptyAction: 'Add Income',
    count: s => s.income_streams.length,
    isComplete: s => s.income_streams.length > 0,
    isRequired: true,
  },
  {
    tab: 'Accounts',
    label: 'Accounts',
    subtitle: '401k, IRA, savings',
    emptyPrompt: 'Add your investment and savings accounts — 401k, IRA, Roth, brokerage, or any other accounts.',
    emptyAction: 'Add an Account',
    count: s => s.accounts.length,
    isComplete: s => s.accounts.length > 0,
    isRequired: true,
  },
  {
    tab: 'Budget',
    label: 'Budget',
    subtitle: 'Monthly spending categories',
    emptyPrompt: 'Define your monthly budget so the projection knows how much you plan to spend in retirement.',
    emptyAction: 'Set Up Budget',
    count: s => s.budget_settings.categories.filter(c => c.include).length,
    isComplete: s => s.budget_settings.categories.some(c => c.include),
    isRequired: false,
  },
  {
    tab: 'Tax',
    label: 'Tax',
    subtitle: 'Filing status and deductions',
    emptyPrompt: 'Configure your tax settings — filing status and standard deduction — to get accurate projections.',
    emptyAction: 'Configure Tax',
    count: _ => 0,
    isComplete: s => !!s.tax_settings.filing_status,
    isRequired: false,
  },
  {
    tab: 'Settings',
    label: 'Settings',
    subtitle: 'Projection window and state',
    emptyPrompt: 'Review your projection settings — start date, end year, and state of residence.',
    emptyAction: 'Review Settings',
    count: _ => 0,
    isComplete: _ => true,   // always has defaults
    isRequired: false,
  },
]

// ─── helpers ──────────────────────────────────────────────────────────────

function emptyScenario(): Scenario {
  return {
    scenario_id: crypto.randomUUID(),
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

function isScenarioReady(s: Scenario): boolean {
  return STEPS.filter(st => st.isRequired).every(st => st.isComplete(s))
}

function nextIncompleteStep(s: Scenario): StepConfig | null {
  return STEPS.find(st => !st.isComplete(s)) ?? null
}

// ─── sub-components ───────────────────────────────────────────────────────

function ProgressTracker({
  scenario,
  activeTab,
  onTabClick,
}: {
  scenario: Scenario
  activeTab: Tab
  onTabClick: (tab: Tab) => void
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
      <div className="flex items-start justify-between gap-2 flex-wrap sm:flex-nowrap">
        {STEPS.map((step, i) => {
          const complete = step.isComplete(scenario)
          const active = activeTab === step.tab
          const count = step.count(scenario)

          return (
            <button
              key={step.tab}
              onClick={() => onTabClick(step.tab)}
              className="flex-1 min-w-0 flex flex-col items-center gap-1 group"
            >
              {/* connector line + circle row */}
              <div className="flex items-center w-full">
                {/* left line */}
                <div className={`h-px flex-1 ${i === 0 ? 'opacity-0' : complete ? 'bg-gold-500' : 'bg-slate-700'}`} />

                {/* circle */}
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                  transition-all duration-200
                  ${active
                    ? 'bg-gold-500 text-slate-950 ring-2 ring-gold-400 ring-offset-2 ring-offset-slate-900'
                    : complete
                      ? 'bg-gold-600/30 text-gold-400 border border-gold-600'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 group-hover:border-slate-500'
                  }
                `}>
                  {complete && !active ? '✓' : i + 1}
                </div>

                {/* right line */}
                <div className={`h-px flex-1 ${i === STEPS.length - 1 ? 'opacity-0' : complete ? 'bg-gold-500' : 'bg-slate-700'}`} />
              </div>

              {/* label */}
              <span className={`
                font-sans text-xs font-semibold text-center leading-tight
                ${active ? 'text-gold-400' : complete ? 'text-gold-600' : 'text-slate-500 group-hover:text-slate-400'}
              `}>
                {step.label}
                {count > 0 && (
                  <span className="ml-1 opacity-60">({count})</span>
                )}
              </span>

              {/* subtitle */}
              <span className="font-sans text-xs text-slate-600 text-center leading-tight hidden sm:block">
                {step.subtitle}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function WhatsNext({
  scenario,
  onTabClick,
  isNew,
}: {
  scenario: Scenario
  onTabClick: (tab: Tab) => void
  isNew: boolean
}) {
  const ready = isScenarioReady(scenario)
  const next = nextIncompleteStep(scenario)

  if (ready) {
    return (
      <div className="bg-gold-600/10 border border-gold-600/30 rounded-xl px-5 py-4 mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎉</span>
          <div>
            <p className="font-sans text-gold-400 font-semibold text-sm">
              Your scenario is ready to run!
            </p>
            <p className="font-sans text-slate-400 text-xs mt-0.5">
              Save your scenario, then view the projection results.
            </p>
          </div>
        </div>
        {!isNew && (
          <Link
            to={`/scenarios/${scenario.scenario_id}/results`}
            className="shrink-0 inline-flex items-center gap-1.5 bg-gold-600 hover:bg-gold-500 text-slate-950 font-sans font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
          >
            View Results →
          </Link>
        )}
      </div>
    )
  }

  if (!next) return null

  // find which required steps are still missing for the mini-checklist
  const requiredSteps = STEPS.filter(s => s.isRequired)

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-5 py-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5">👋</span>
        <div className="flex-1 min-w-0">
          <p className="font-sans text-white font-semibold text-sm mb-1">
            What's next: <span className="text-gold-400">{next.label}</span>
          </p>
          <p className="font-sans text-slate-400 text-sm mb-3">
            {next.emptyPrompt}
          </p>

          {/* mini progress checklist for required steps */}
          <div className="flex flex-wrap gap-3 mb-3">
            {requiredSteps.map(step => (
              <div key={step.tab} className="flex items-center gap-1.5">
                <span className={`text-xs ${step.isComplete(scenario) ? 'text-gold-400' : 'text-slate-600'}`}>
                  {step.isComplete(scenario) ? '✓' : '○'}
                </span>
                <span className={`font-sans text-xs ${step.isComplete(scenario) ? 'text-slate-400 line-through' : 'text-slate-400'}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={() => onTabClick(next.tab)}
            className="inline-flex items-center gap-1.5 bg-gold-600 hover:bg-gold-500 text-slate-950 font-sans font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            {next.emptyAction} →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── more menu ────────────────────────────────────────────────────────────

function MoreMenu({
  onExport,
  onDuplicate,
  onValidate,
  dupLoading,
  validating,
  isNew,
}: {
  onExport: () => void
  onDuplicate: () => void
  onValidate: () => void
  dupLoading: boolean
  validating: boolean
  isNew: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (isNew) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="font-sans text-slate-400 hover:text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors"
      >
        ⋯ More
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <button
            onClick={() => { onValidate(); setOpen(false) }}
            disabled={validating}
            className="w-full text-left px-4 py-2.5 font-sans text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
          >
            {validating ? '✓ Validating…' : '✓ Validate'}
          </button>
          <button
            onClick={() => { onDuplicate(); setOpen(false) }}
            disabled={dupLoading}
            className="w-full text-left px-4 py-2.5 font-sans text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
          >
            {dupLoading ? '⧉ Duplicating…' : '⧉ Duplicate'}
          </button>
          <button
            onClick={() => { onExport(); setOpen(false) }}
            className="w-full text-left px-4 py-2.5 font-sans text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            ↓ Export JSON
          </button>
        </div>
      )}
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────

export default function ScenarioEditor() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew    = !id

  const scenarioQuery = useScenario(id ?? '', !isNew)
  const createMut     = useCreateScenario()
  const updateMut     = useUpdateScenario()
  const validateMut   = useValidateScenario()
  const qc            = useQueryClient()

  const [scenario,           setScenario]           = useState<Scenario>(emptyScenario)
  const [activeTab,          setActiveTab]          = useState<Tab>('People')
  const [saving,             setSaving]             = useState(false)
  const [saved,              setSaved]              = useState(false)
  const [error,              setError]              = useState<string | null>(null)
  const [dupLoading,         setDupLoading]         = useState(false)
  const [validating,         setValidating]         = useState(false)
  const [validationErrors,   setValidationErrors]   = useState<string[]>([])
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])
  const [validationPassed,   setValidationPassed]   = useState(false)

  // populate when editing
  useEffect(() => {
    if (scenarioQuery.data) {
      setScenario(scenarioQuery.data)
    }
  }, [scenarioQuery.data])

  // auto-advance to next incomplete step when a step becomes complete
  const prevComplete = useRef<boolean>(false)
  useEffect(() => {
    const currentStepComplete = STEPS.find(s => s.tab === activeTab)?.isComplete(scenario) ?? false
    if (currentStepComplete && !prevComplete.current) {
      const next = STEPS.find(s => s.tab !== activeTab && !s.isComplete(scenario))
      if (next) setActiveTab(next.tab)
    }
    prevComplete.current = currentStepComplete
  }, [scenario, activeTab])

  // ── save ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setError(null)
    setSaved(false)
    setSaving(true)
    try {
      if (isNew) {
        await createMut.mutateAsync(scenario)
        saveScenarioToStorage(scenario)
        navigate(`/scenarios/${scenario.scenario_id}`)
      } else {
        await updateMut.mutateAsync(scenario)
        saveScenarioToStorage(scenario)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail
      setError(detail ? parseValidationError(detail) : 'An unexpected error occurred.')
    } finally {
      setSaving(false)
    }
  }

  // ── duplicate ─────────────────────────────────────────────────────────
  const handleDuplicate = async () => {
    setError(null)
    setDupLoading(true)
    try {
      const newId = crypto.randomUUID()
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

  // ── validate ──────────────────────────────────────────────────────────
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

  // ── loading / error states ────────────────────────────────────────────
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

  // ── render ────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in max-w-4xl">

      {/* ── header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl text-white">
            {isNew ? 'New Scenario' : 'Edit Scenario'}
          </h1>
          <p className="font-sans text-slate-500 text-sm mt-1">
            {isNew ? 'Fill in each step below to build your plan.' : `Editing "${scenario.scenario_name}"`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <MoreMenu
            onExport={exportScenarioAsFile.bind(null, scenario)}
            onDuplicate={handleDuplicate}
            onValidate={handleValidate}
            dupLoading={dupLoading}
            validating={validating}
            isNew={isNew}
          />
          <button
            onClick={handleSave}
            disabled={saving || !scenario.scenario_name}
            className="
              inline-flex items-center justify-center
              bg-gold-600 hover:bg-gold-500
              disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed
              text-slate-950 font-sans font-semibold text-sm
              px-6 py-2.5 rounded-lg transition-colors duration-150
            "
          >
            {saving ? 'Saving…' : isNew ? 'Create Scenario' : 'Save Scenario'}
          </button>
        </div>
      </div>

      {/* ── name / description ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
        <div className="mb-4">
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
            Scenario Name <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            value={scenario.scenario_name}
            onChange={e => setScenario(prev => ({ ...prev, scenario_name: e.target.value }))}
            placeholder="e.g. Jon &amp; Rebecca's Retirement"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm placeholder-slate-600"
          />
        </div>
        <div>
          <label className="block font-sans text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
            Description <span className="text-slate-600 font-normal normal-case">(optional)</span>
          </label>
          <textarea
            value={scenario.description}
            onChange={e => setScenario(prev => ({ ...prev, description: e.target.value }))}
            placeholder="e.g. Base plan assuming both retire at 65…"
            rows={2}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-sans text-sm placeholder-slate-600 resize-none"
          />
        </div>
      </div>

      {/* ── banners ── */}
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

      {/* ── progress tracker ── */}
      <ProgressTracker
        scenario={scenario}
        activeTab={activeTab}
        onTabClick={setActiveTab}
      />

      {/* ── what's next card ── */}
      <WhatsNext
        scenario={scenario}
        onTabClick={setActiveTab}
        isNew={isNew}
      />

      {/* ── tab content ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        {activeTab === 'People'   && <PeopleTab    people={scenario.people}                    onChange={v => setScenario(prev => ({ ...prev, people: v }))}           />}
        {activeTab === 'Income'   && <IncomeTab    streams={scenario.income_streams} people={scenario.people} onChange={v => setScenario(prev => ({ ...prev, income_streams: v }))} />}
        {activeTab === 'Accounts' && <AccountsTab  accounts={scenario.accounts}                onChange={v => setScenario(prev => ({ ...prev, accounts: v }))}        />}
        {activeTab === 'Budget'   && <BudgetTab    budget={scenario.budget_settings}           onChange={v => setScenario(prev => ({ ...prev, budget_settings: v }))} />}
        {activeTab === 'Tax'      && <TaxTab       tax={scenario.tax_settings}                 onChange={v => setScenario(prev => ({ ...prev, tax_settings: v }))}    />}
        {activeTab === 'Settings' && <GlobalSettingsTab settings={scenario.global_settings}   onChange={v => setScenario(prev => ({ ...prev, global_settings: v }))}  />}
      </div>
    </div>
  )
}
