/**
 * ExecutiveSummary
 * 
 * Professional one-page financial dashboard
 */

import { useParams, Link } from 'react-router-dom'
import { useProjection, useScenario, useAnalysis } from '@/api/hooks'
import ExpensePieChart from '@/components/results/ExpensePieChart'
import TaxBucketChart from '@/components/results/TaxBucketChart'
import SankeyChart from '@/components/results/SankeyChart'
import AccountPictorialChart from '@/components/results/AccountPictorialChart'

const fmt = (n: number) => '$' + Math.round(Math.abs(n)).toLocaleString()

export default function ExecutiveSummary() {
  const { id = '' } = useParams()
  const { data: scenario, isLoading: scenarioLoading } = useScenario(id)
  const { data: projection, isLoading: projectionLoading } = useProjection(id, true)
  const { data: analysis, isLoading: analysisLoading } = useAnalysis(id)

  if (scenarioLoading || projectionLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="font-sans text-slate-500 text-sm">Loading executive summary...</div>
      </div>
    )
  }

  if (!scenario || !projection) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="font-sans text-slate-500 text-sm">Scenario not found</div>
      </div>
    )
  }

  const monthly = projection.monthly_projections || []
  const summary = projection.financial_summary || { total_surplus_deficit: 0, average_monthly_surplus_deficit: 0, months_in_surplus: 0, months_in_deficit: 0 }

  // Aggregate data for Sankey chart
  // Create person ID to name mapping
  const personMap = new Map<string, string>()
  scenario.people?.forEach(person => {
    personMap.set(person.person_id, person.name)
  })

  // Create income stream ID to descriptive name mapping
  const incomeStreamMap = new Map<string, string>()
  scenario.income_streams?.forEach(stream => {
    const typeName = stream.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
    const ownerName = personMap.get(stream.owner_person_id) || 'Unknown'
    incomeStreamMap.set(stream.stream_id, `${typeName} (${ownerName})`)
  })

  // Create income source name to type mapping for Sankey coloring
  const incomeSourceTypes: Record<string, string> = {}
  scenario.income_streams?.forEach(stream => {
    const typeName = stream.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
    const ownerName = personMap.get(stream.owner_person_id) || 'Unknown'
    const sourceName = `${typeName} (${ownerName})`
    incomeSourceTypes[sourceName] = stream.type
  })

  const incomeBySource: Record<string, number> = {}
  const expensesByCategory: Record<string, number> = {}
  let totalFederalTax = 0
  let totalStateTax = 0
  monthly.forEach(month => {
    // Aggregate income by source
    Object.entries(month.income_by_stream || {}).forEach(([streamId, amount]) => {
      const streamName = incomeStreamMap.get(streamId) || streamId
      incomeBySource[streamName] = (incomeBySource[streamName] || 0) + amount
    })

    // Aggregate expenses by individual item name
    scenario.budget_settings?.categories?.forEach(cat => {
      if (cat.include) {
        expensesByCategory[cat.category_name] = (expensesByCategory[cat.category_name] || 0) + cat.monthly_amount
      }
    })
  })

  // Get total taxes from projection tax summaries
  projection.tax_summaries?.forEach(yearTax => {
    totalFederalTax += yearTax.federal_tax || 0
    totalStateTax += yearTax.state_tax || 0
  })

  const netSavings = summary.total_surplus_deficit || 0
  // Find surplus account name
  const surplusAccount = scenario.accounts.find(acc => acc.receives_surplus)
  const surplusAccountName = surplusAccount?.name || 'Net Savings'
  console.log('DEBUG Executive Summary:', {
    hasScenario: !!scenario,
    hasProjection: !!projection,
    hasBudgetSettings: !!scenario?.budget_settings,
    hasCategories: !!scenario?.budget_settings?.categories,
    categoriesLength: scenario?.budget_settings?.categories?.length,
    hasAccounts: !!scenario?.accounts,
    accountsLength: scenario?.accounts?.length,
    monthlyLength: monthly.length,
    projectionKeys: projection ? Object.keys(projection) : [],
    projectionMonthlyDataType: typeof projection?.monthly_data,
    projectionMonthlyDataIsArray: Array.isArray(projection?.monthly_data),
    rawProjection: projection
  })
  const startingPortfolio = monthly.length > 0 ? monthly[0].total_investments : 0
  const endingPortfolio = monthly.length > 0 ? monthly[monthly.length - 1].total_investments : 0

  // Calculate key metrics
  const totalMonths = monthly.length
  const totalYears = Math.round(totalMonths / 12)
  const growthAmount = endingPortfolio - startingPortfolio
  const growthPercent = startingPortfolio > 0 ? ((endingPortfolio / startingPortfolio - 1) * 100) : 0

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-sans text-3xl font-bold text-white mb-1">
                Executive Summary
              </h1>
              <p className="font-sans text-slate-400 text-sm">
                {scenario.scenario_name}
              </p>
            </div>
            <Link
              to={`/scenarios/${id}/results`}
              className="font-sans text-sm text-gold-500 hover:text-gold-400 border border-gold-600 hover:border-gold-500 px-4 py-2 rounded-lg transition-colors"
            >
              ← Back to Full Results
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        
        {/* Section 1: Profile & Goal Calibration */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
          <h2 className="font-sans text-xl font-semibold text-white mb-4">
            Household Profile
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* People */}
            <div>
              <h3 className="font-sans text-xs uppercase tracking-wider text-slate-500 mb-2">
                Household Members
              </h3>
              {scenario.people.map(person => (
                <div key={person.person_id} className="mb-2">
                  <p className="font-sans text-white font-medium">{person.name}</p>
                  <p className="font-sans text-slate-400 text-sm">
                    Born {new Date(person.birth_date).getFullYear()}
                    {person.life_expectancy_years && ` • Life expectancy: ${person.life_expectancy_years} years`}
                  </p>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div>
              <h3 className="font-sans text-xs uppercase tracking-wider text-slate-500 mb-2">
                Planning Timeline
              </h3>
              <p className="font-sans text-white">
                <span className="text-2xl font-bold">{totalYears}</span> years
              </p>
              <p className="font-sans text-slate-400 text-sm mt-1">
                {scenario.global_settings.projection_start_month} → {scenario.global_settings.projection_end_year}
              </p>
            </div>

            {/* Key Outcome */}
            <div>
              <h3 className="font-sans text-xs uppercase tracking-wider text-slate-500 mb-2">
                Portfolio Growth
              </h3>
              <p className="font-sans text-white">
                <span className="text-2xl font-bold text-success">+{growthPercent.toFixed(0)}%</span>
              </p>
              <p className="font-sans text-slate-400 text-sm mt-1">
                {fmt(startingPortfolio)} → {fmt(endingPortfolio)}
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Key Metrics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="font-sans text-slate-500 text-xs uppercase tracking-wider mb-1">
              Ending Portfolio
            </p>
            <p className="font-sans text-white text-2xl font-semibold">
              {fmt(endingPortfolio)}
            </p>
          </div>

          <div className="bg-slate-900 border border-success/25 rounded-xl p-4">
            <p className="font-sans text-slate-500 text-xs uppercase tracking-wider mb-1">
              Cumulative Surplus
            </p>
            <p className="font-sans text-success text-2xl font-semibold">
              {fmt(summary.total_surplus_deficit)}
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="font-sans text-slate-500 text-xs uppercase tracking-wider mb-1">
              Avg Monthly Surplus
            </p>
            <p className="font-sans text-success text-2xl font-semibold">
              {fmt(summary.average_monthly_surplus_deficit)}
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="font-sans text-slate-500 text-xs uppercase tracking-wider mb-1">
              Success Rate
            </p>
            <p className="font-sans text-white text-2xl font-semibold">
              {summary.months_in_surplus}/{totalMonths}
            </p>
            <p className="font-sans text-slate-400 text-xs mt-1">
              {((summary.months_in_surplus / totalMonths) * 100).toFixed(0)}% months in surplus
            </p>
          </div>
        </div>

        {/* Section 3: Visual Suite */}
        <div className="grid grid-cols-1 gap-6 mb-6">
          {/* Pictorial Account Chart */}
          <AccountPictorialChart 
            accounts={scenario.accounts}
            balances={monthly.length > 0 ? monthly[monthly.length - 1].balances_by_account : {}}
          />
          
          {/* Existing Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ExpensePieChart categories={scenario.budget_settings?.categories || []} />
            <TaxBucketChart accounts={scenario.accounts || []} />
          </div>
        </div>

        {/* Cash Flow Sankey */}
        <div className="mb-6 max-w-6xl mx-auto">
          <SankeyChart
            incomeBySource={incomeBySource}
            incomeSourceTypes={incomeSourceTypes}
            expensesByCategory={expensesByCategory}
            federalTax={totalFederalTax}
            stateTax={totalStateTax}
            savings={netSavings}
            surplusAccountName={surplusAccountName}
          />
        </div>

{/* Section 4: AI-Powered Analysis */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="font-sans text-xl font-semibold text-white mb-4">
            Financial Analysis
          </h2>
          
          {analysisLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-500"></div>
              <span className="ml-3 text-slate-400">Generating CFP-level analysis...</span>
            </div>
          ) : analysis?.analysis ? (
            <div className="prose prose-invert prose-slate max-w-none">
              <div 
                className="text-slate-300 text-sm leading-relaxed space-y-4"
                dangerouslySetInnerHTML={{ 
                  __html: analysis.analysis
                    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-gold-500">$1</strong>')
                    .replace(/### (.*?)$/gm, '<h3 class="text-white text-base font-semibold mt-6 mb-3">$1</h3>')
                    .replace(/- (.*?)$/gm, '<li class="ml-4">$1</li>')
                    .replace(/\n\n/g, '</p><p class="mt-4">')
                }}
              />
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Analysis unavailable. Please check your configuration.</p>
          )}
        </div>

      </div>
    </div>
  )
}
