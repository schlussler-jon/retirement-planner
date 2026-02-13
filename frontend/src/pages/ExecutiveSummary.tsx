/**
 * ExecutiveSummary
 * 
 * Professional one-page financial dashboard
 */

import { useParams, Link } from 'react-router-dom'
import { useProjection, useScenario } from '@/api/hooks'
import ExpensePieChart from '@/components/results/ExpensePieChart'
import TaxBucketChart from '@/components/results/TaxBucketChart'

const fmt = (n: number) => '$' + Math.round(Math.abs(n)).toLocaleString()

export default function ExecutiveSummary() {
  const { id = '' } = useParams()
  const { data: scenario, isLoading: scenarioLoading } = useScenario(id)
  const { data: projection, isLoading: projectionLoading } = useProjection(id)

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

  const monthly = projection.monthly_data || []
  const summary = projection.financial_summary || { total_surplus_deficit: 0, average_monthly_surplus_deficit: 0, months_in_surplus: 0, months_in_deficit: 0 }
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <ExpensePieChart categories={scenario.budget_settings.categories} />
          <TaxBucketChart accounts={scenario.investment_accounts} />
        </div>

        {/* Section 4: Analysis & Insights */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="font-sans text-xl font-semibold text-white mb-4">
            Financial Analysis
          </h2>
          
          <div className="space-y-4">
            {/* Portfolio Health */}
            <div>
              <h3 className="font-sans text-sm font-semibold text-gold-500 mb-2">
                ✓ Portfolio Health
              </h3>
              <p className="font-sans text-slate-300 text-sm leading-relaxed">
                Your portfolio is projected to grow from {fmt(startingPortfolio)} to {fmt(endingPortfolio)} 
                over {totalYears} years, representing a {growthPercent.toFixed(1)}% increase. With {summary.months_in_surplus} months 
                in surplus out of {totalMonths} total months ({((summary.months_in_surplus / totalMonths) * 100).toFixed(0)}%), 
                your plan demonstrates strong financial sustainability.
              </p>
            </div>

            {/* Cash Flow Analysis */}
            <div>
              <h3 className="font-sans text-sm font-semibold text-gold-500 mb-2">
                ✓ Cash Flow Analysis
              </h3>
              <p className="font-sans text-slate-300 text-sm leading-relaxed">
                Your cumulative surplus of {fmt(summary.total_surplus_deficit)} indicates healthy cash flow 
                management. On average, you're generating {fmt(summary.average_monthly_surplus_deficit)} in 
                monthly surplus, which provides a cushion for unexpected expenses and accelerates portfolio growth.
              </p>
            </div>

            {/* Tax Strategy */}
            {scenario.investment_accounts.length > 0 && (
              <div>
                <h3 className="font-sans text-sm font-semibold text-gold-500 mb-2">
                  → Tax Diversification Opportunity
                </h3>
                <p className="font-sans text-slate-300 text-sm leading-relaxed">
                  Review your tax bucket distribution to optimize withdrawal strategies in retirement. 
                  Consider balancing contributions across taxable, tax-deferred, and Roth accounts to maximize 
                  tax flexibility during retirement years.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
