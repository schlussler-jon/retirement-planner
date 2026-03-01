/**
 * Help
 *
 * Comprehensive documentation for my-moneyplan.com.
 * Updated to reflect current feature set.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

interface SectionProps {
  title:        string
  icon:         string
  children:     React.ReactNode
  defaultOpen?: boolean
}

function Section({ title, icon, children, defaultOpen = false }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className="border border-violet-900 rounded-xl mb-4 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <h2 className="font-sans text-base font-semibold text-white">{title}</h2>
        </div>
        {isOpen
          ? <ChevronDown className="text-violet-400 shrink-0" size={18} />
          : <ChevronRight className="text-slate-500 shrink-0" size={18} />}
      </button>
      {isOpen && (
        <div className="px-5 pb-5 border-t border-violet-900/50">
          <div className="pt-4 space-y-4 text-sm text-slate-300 leading-relaxed">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 bg-gold-900/20 border border-gold-800/30 rounded-lg p-3 mt-2">
      <span className="text-gold-400 shrink-0">💡</span>
      <p className="font-sans text-gold-300 text-xs leading-relaxed">{children}</p>
    </div>
  )
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 bg-orange-900/20 border border-orange-800/30 rounded-lg p-3 mt-2">
      <span className="text-orange-400 shrink-0">⚠️</span>
      <p className="font-sans text-orange-300 text-xs leading-relaxed">{children}</p>
    </div>
  )
}

export default function Help() {
  return (
    <div className="max-w-3xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl text-white mb-2">Help & Documentation</h1>
        <p className="font-sans text-slate-400 text-sm">
          Everything you need to get the most out of my-moneyplan.com
        </p>
        <Link to="/updates" className="font-sans text-violet-400 hover:text-violet-300 text-xs mt-2 inline-block transition-colors">
          View release notes & what's new →
        </Link>
      </div>

      {/* Getting Started */}
      <Section title="Getting Started" icon="🚀" defaultOpen>
        <p>
          my-moneyplan.com helps you model your retirement by projecting income, expenses, taxes,
          and investment growth month by month over your entire retirement timeline. You can create
          multiple scenarios to test different strategies side by side.
        </p>

        <div>
          <p className="font-sans text-white font-semibold mb-2">Quick Start:</p>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
            <li>Click <strong className="text-white">+ New Scenario</strong> on the Dashboard</li>
            <li>Fill out the tabs: Settings, People, Income, Accounts, Budget</li>
            <li>Click <strong className="text-white">Save & View Results</strong></li>
            <li>Explore Charts, Executive Summary, Monte Carlo, and Roth Strategy tabs</li>
          </ol>
        </div>

        <Tip>
          Export your scenarios as JSON regularly as a backup. Use the Export JSON button on each scenario card.
        </Tip>
      </Section>

      {/* Settings */}
      <Section title="Settings & Timeline" icon="⚙️">
        <div>
          <p className="font-sans text-white font-semibold mb-1">Projection Start Month</p>
          <p>When to begin the projection (e.g., 2026-01 for January 2026). Typically set to the current month or your planned retirement date.</p>
        </div>
        <div>
          <p className="font-sans text-white font-semibold mb-1">Projection End Year</p>
          <p>How far into the future to project. Choose a year well beyond your expected lifespan. 30–50 year projections are typical.</p>
        </div>
        <div>
          <p className="font-sans text-white font-semibold mb-1">Residence State</p>
          <p>Your state for tax calculations. Currently supported: California (CA) and Arizona (AZ). More states coming soon.</p>
        </div>
        <div>
          <p className="font-sans text-white font-semibold mb-1">Inflation & Survivor Settings</p>
          <p>Set your assumed inflation rate and survivor spending percentage (what % of spending continues if one person passes away).</p>
        </div>
        <Tip>Use a conservative inflation assumption of 3.0–3.5% for long projections.</Tip>
      </Section>

      {/* People */}
      <Section title="People" icon="👤">
        <p>Add everyone in your household — yourself and your spouse or partner if applicable. People are linked to income streams and used for tax filing status.</p>

        <div>
          <p className="font-sans text-white font-semibold mb-2">Fields:</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong className="text-white">Full Name</strong> — used in reports and AI analysis</li>
            <li><strong className="text-white">Date of Birth</strong> — drives age-based calculations</li>
            <li><strong className="text-white">Life Expectancy</strong> — how long to run the projection for this person</li>
            <li><strong className="text-white">Employment Status</strong> — Working, Self-Employed, Retired, Not Working</li>
            <li><strong className="text-white">Planned Retirement Date</strong> — shown when actively working; used in AI analysis</li>
            <li><strong className="text-white">Social Security Start Date</strong> — when you started or plan to start collecting SS</li>
          </ul>
        </div>

        <Tip>
          The AI analysis uses your employment status, planned retirement date, and Social Security start date to give you personalized recommendations — fill these in for better insights.
        </Tip>
      </Section>

      {/* Income */}
      <Section title="Income Streams" icon="💰">
        <p>Model all income sources. Each stream can have different start/end dates, amounts, and cost-of-living adjustments (COLA).</p>

        <div>
          <p className="font-sans text-white font-semibold mb-2">Income Types:</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong className="text-white">Pension</strong> — employer pension or defined benefit payments</li>
            <li><strong className="text-white">Social Security</strong> — SSA retirement benefits</li>
            <li><strong className="text-white">Salary</strong> — W-2 wages from employment</li>
            <li><strong className="text-white">Self Employment</strong> — 1099 or business income</li>
            <li><strong className="text-white">Rental</strong> — rental property income</li>
            <li><strong className="text-white">Annuity</strong> — fixed annuity payments</li>
            <li><strong className="text-white">Other</strong> — royalties, dividends, part-time work, etc.</li>
          </ul>
        </div>

        <Tip>
          Delaying Social Security from 62 to 70 increases your monthly benefit by roughly 76%. Each year of delay after full retirement age (67) adds ~8%.
        </Tip>

        <Warning>
          Set realistic COLA rates. Social Security uses actual CPI adjustments (~2–3%/yr). Most private pensions have fixed or 0% COLA.
        </Warning>
      </Section>

      {/* Accounts */}
      <Section title="Investment Accounts" icon="📈">
        <p>Add all investment accounts: 401(k), IRA, Roth IRA, brokerage, savings, etc. The engine tracks balances, applies growth, and models contributions and withdrawals over time.</p>

        <div>
          <p className="font-sans text-white font-semibold mb-2">Tax Buckets:</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong className="text-white">Tax-Deferred</strong> — 401(k), 403(b), Traditional IRA, 457(b). Withdrawals taxed as ordinary income. Subject to RMDs at age 73.</li>
            <li><strong className="text-white">Roth</strong> — Roth IRA, Roth 401(k). Qualified withdrawals are tax-free. No RMDs on Roth IRA.</li>
            <li><strong className="text-white">Taxable</strong> — Brokerage, savings, money market. Growth may be subject to capital gains tax.</li>
          </ul>
        </div>

        <div>
          <p className="font-sans text-white font-semibold mb-2">Key Fields:</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong className="text-white">Starting Balance</strong> — current value of the account</li>
            <li><strong className="text-white">Expected Annual Return</strong> — assumed growth rate (e.g., 7% for equities)</li>
            <li><strong className="text-white">Monthly Contribution</strong> — ongoing deposits (use date range to limit to working years)</li>
            <li><strong className="text-white">Monthly Withdrawal</strong> — scheduled withdrawals (use date range for specific periods)</li>
            <li><strong className="text-white">Receives Surplus</strong> — designate one account to receive monthly cash flow surplus</li>
          </ul>
        </div>

        <Tip>
          Diversifying across all three tax buckets gives you flexibility in retirement to manage your taxable income each year — crucial for minimizing taxes and avoiding Medicare IRMAA surcharges.
        </Tip>

        <Warning>
          2025 IRS contribution limits: 401(k) $23,500/yr ($31,000 if 50+), IRA $7,000/yr ($8,000 if 50+).
        </Warning>
      </Section>

      {/* Budget */}
      <Section title="Budget & Expenses" icon="🏠">
        <p>Model your monthly spending across all categories. Each expense can have its own inflation rate and optional start/end dates for expenses that change over time.</p>

        <div>
          <p className="font-sans text-white font-semibold mb-2">Tips by category:</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong className="text-white">Housing</strong> — mortgage payment (use end date when paid off), property tax, HOA</li>
            <li><strong className="text-white">Healthcare</strong> — use 4–5% inflation; costs typically rise faster than general inflation</li>
            <li><strong className="text-white">Travel/Lifestyle</strong> — consider "go-go, slow-go, no-go" phases — spending often peaks in early retirement then declines</li>
            <li><strong className="text-white">One-time expenses</strong> — use start/end date for same month to model a lump-sum cost</li>
          </ul>
        </div>

        <Tip>Use the survivor spending setting (in Settings tab) to automatically reduce expenses when one person passes away.</Tip>
      </Section>

      {/* Results */}
      <Section title="Understanding Results" icon="📊">
        <p>Results are organized across multiple tabs after running your projection:</p>

        <div>
          <p className="font-sans text-white font-semibold mb-2">Result Tabs:</p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong className="text-white">Charts</strong> — portfolio growth over time, income vs expenses, tax bucket breakdown, expense pie chart</li>
            <li><strong className="text-white">Executive Summary</strong> — Sankey flow chart, AI-powered CFP-level analysis, Monte Carlo simulation</li>
            <li><strong className="text-white">Roth Strategy</strong> — RMD projections, Roth conversion optimizer, lifetime tax savings analysis</li>
            <li><strong className="text-white">Annual</strong> — year-by-year summary table</li>
            <li><strong className="text-white">Net Income</strong> — monthly net income after taxes and expenses</li>
            <li><strong className="text-white">Tax</strong> — detailed federal and state tax breakdown by year</li>
            <li><strong className="text-white">Monthly Detail</strong> — full month-by-month projection data</li>
          </ul>
        </div>

        <div>
          <p className="font-sans text-white font-semibold mb-2">Key Metrics:</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li>✅ <strong className="text-white">Positive Ending Portfolio</strong> — your plan doesn't run out of money</li>
            <li>✅ <strong className="text-white">High Surplus % of months</strong> — most months have positive cash flow</li>
            <li>⚠️ <strong className="text-white">Negative Ending Portfolio</strong> — may outlive savings; consider adjusting income or expenses</li>
            <li>⚠️ <strong className="text-white">High Deficit Months</strong> — frequent cash flow gaps that draw down the portfolio faster</li>
          </ul>
        </div>
      </Section>

      {/* Plan Health Score */}
      <Section title="Plan Health Score" icon="🎯">
        <p>Each scenario card shows a Plan Health Score (0–100) displayed as a speedometer gauge. Hover over it to see the full breakdown.</p>

        <div>
          <p className="font-sans text-white font-semibold mb-2">Score Components:</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong className="text-white">Survival Rate (30 pts)</strong> — % of months with positive cash flow. Aim for 95%+.</li>
            <li><strong className="text-white">Portfolio Growth (20 pts)</strong> — ending portfolio vs starting. Full points at 2x growth.</li>
            <li><strong className="text-white">Surplus Cushion (20 pts)</strong> — average monthly surplus as % of spending.</li>
            <li><strong className="text-white">Contribution Utilization (15 pts)</strong> — how close to IRS maximum contributions. Retired users get full points automatically.</li>
            <li><strong className="text-white">Tax Diversification (15 pts)</strong> — balance across tax-deferred, Roth, and taxable accounts. Penalizes concentration over 60% in any bucket.</li>
          </ul>
        </div>

        <div>
          <p className="font-sans text-white font-semibold mb-2">Score Ranges:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><span className="text-green-400">80–100: Strong Plan</span></li>
            <li><span className="text-yellow-400">60–79: On Track</span></li>
            <li><span className="text-orange-400">40–59: Needs Work</span></li>
            <li><span className="text-red-400">0–39: At Risk</span></li>
          </ul>
        </div>
      </Section>

      {/* Monte Carlo */}
      <Section title="Monte Carlo Analysis" icon="🎲">
        <p>
          The Monte Carlo simulation runs 1,000 projections of your plan, each with different randomized
          annual market returns. This shows the range of possible outcomes rather than a single fixed-return projection.
        </p>

        <div>
          <p className="font-sans text-white font-semibold mb-2">How it works:</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li>Each simulation draws random annual returns from a normal distribution (mean = your assumed rate, std dev = 12% — historical market volatility)</li>
            <li>The fan chart shows the 10th, 25th, 50th, 75th, and 90th percentile outcomes</li>
            <li>The success rate is the % of simulations where the portfolio never hits $0</li>
            <li>Results are cached for 24 hours — click "refresh" to re-run with a new random seed</li>
          </ul>
        </div>

        <Tip>
          A success rate of 85%+ is generally considered a strong plan by financial planners. Below 75% suggests adjustments may be needed.
        </Tip>
      </Section>

      {/* Roth Strategy */}
      <Section title="Roth Strategy & RMD Analysis" icon="🔄">
        <p>
          The Roth Strategy tab helps you model the impact of converting tax-deferred funds (401k, IRA) to Roth
          before Required Minimum Distributions (RMDs) begin at age 73.
        </p>

        <div>
          <p className="font-sans text-white font-semibold mb-2">Why convert to Roth?</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li>Large tax-deferred balances force large taxable RMDs at 73+, often pushing you into higher brackets</li>
            <li>Converting during low-income years (often between retirement and age 73) can be taxed at lower rates</li>
            <li>Reduces future RMDs and the associated taxes on them</li>
            <li>Roth accounts have no RMDs, grow tax-free, and pass tax-free to heirs</li>
          </ul>
        </div>

        <div>
          <p className="font-sans text-white font-semibold mb-2">Key settings:</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong className="text-white">Annual Conversion</strong> — leave blank for auto-optimization, or enter a specific amount</li>
            <li><strong className="text-white">Target Bracket</strong> — the tool will fill conversions up to this bracket ceiling (22% is common)</li>
            <li><strong className="text-white">Start/End Year</strong> — leave blank to auto-calculate the optimal window</li>
          </ul>
        </div>

        <Warning>
          Roth conversions increase your taxable income in the conversion year. Be careful not to trigger Medicare IRMAA surcharges (2025 threshold: ~$212,000 for married couples). The tool flags IRMAA years automatically.
        </Warning>

        <Tip>
          The optimal conversion window is typically between retirement and age 72 — after earned income stops but before RMDs begin. This is often the lowest-tax period of your retirement.
        </Tip>
      </Section>

      {/* Executive Summary / Sankey */}
      <Section title="Executive Summary & Sankey Chart" icon="🌊">
        <p>The Executive Summary provides a visual overview of your entire retirement cash flow using a Sankey diagram.</p>

        <div>
          <p className="font-sans text-white font-semibold mb-2">Reading the Sankey chart:</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong className="text-white">Left side (sources)</strong> — all income streams flowing in: pensions, Social Security, other income</li>
            <li><strong className="text-white">Right side (destinations)</strong> — where money goes: federal tax, state tax, individual expenses, investment contributions, net savings</li>
            <li><strong className="text-white">Width of flows</strong> — proportional to dollar amount over the entire projection</li>
            <li><strong className="text-white">Blue nodes</strong> — investment accounts receiving monthly contributions</li>
            <li>Hover over any flow or node to see the dollar amount in the info bar above the chart</li>
          </ul>
        </div>

        <div>
          <p className="font-sans text-white font-semibold mb-2">AI Analysis:</p>
          <p>The AI-powered analysis uses your scenario data, ages, milestones, and tax architecture to generate CFP-level recommendations. It references your specific employment status, Social Security timing, and retirement timeline.</p>
        </div>
      </Section>

      {/* Data Security */}
      <Section title="Data & Security" icon="🔒">
        <p>Your financial data is stored securely in an encrypted PostgreSQL database. All scenario data is encrypted at rest using AES-256 encryption.</p>

        <ul className="list-disc list-inside space-y-1.5">
          <li>Authentication via Google OAuth — we never store your Google password</li>
          <li>Each user can only access their own scenarios</li>
          <li>Scenario data is encrypted before storage</li>
          <li>Export your scenarios as JSON anytime for your own backup</li>
        </ul>

        <Tip>
          Use Export JSON to save a local backup of your scenarios. This also lets you share scenarios with a financial advisor.
        </Tip>
      </Section>

      {/* FAQs */}
      <Section title="FAQs" icon="❓">
        <div className="space-y-4">
          <div>
            <p className="font-sans text-white font-semibold mb-1">What return rate should I use?</p>
            <p>Conservative: 4–5%. Moderate: 6–7%. Most planners recommend 5–6% for balanced portfolios in retirement. Use lower rates for bonds/cash, higher for equity-heavy accounts.</p>
          </div>
          <div>
            <p className="font-sans text-white font-semibold mb-1">Can I model part-time work in retirement?</p>
            <p>Yes — add a Salary income stream with a start date and end date covering your part-time working years.</p>
          </div>
          <div>
            <p className="font-sans text-white font-semibold mb-1">How do I model a mortgage payoff?</p>
            <p>Add a housing expense with an end date matching your payoff month. The expense automatically stops after that date.</p>
          </div>
          <div>
            <p className="font-sans text-white font-semibold mb-1">What's the difference between surplus and portfolio growth?</p>
            <p>Surplus is monthly cash flow (income minus expenses and taxes). Positive surplus gets deposited into your designated surplus account. Portfolio growth is the investment return on all account balances.</p>
          </div>
          <div>
            <p className="font-sans text-white font-semibold mb-1">Can I compare multiple scenarios?</p>
            <p>Yes — create multiple scenarios then click Compare in the dashboard header (visible when you have 2+ scenarios).</p>
          </div>
          <div>
            <p className="font-sans text-white font-semibold mb-1">Why are my Monte Carlo results different each time?</p>
            <p>Each run uses a fresh random seed for true variability. Results are cached for 24 hours — click "refresh" to generate a new simulation.</p>
          </div>
        </div>
      </Section>

      {/* Troubleshooting */}
      <Section title="Troubleshooting" icon="🔧">
        <div className="space-y-4">
          <div>
            <p className="font-sans text-white font-semibold mb-1">Projection won't run</p>
            <p>Make sure you have at least one person, one income stream, and one account. All required fields must be filled in.</p>
          </div>
          <div>
            <p className="font-sans text-white font-semibold mb-1">Charts not loading</p>
            <p>Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R). If the issue persists, try logging out and back in.</p>
          </div>
          <div>
            <p className="font-sans text-white font-semibold mb-1">AI analysis not generating</p>
            <p>The AI analysis requires a successful projection to run first. Make sure your scenario has valid data and the projection completed successfully.</p>
          </div>
          <div>
            <p className="font-sans text-white font-semibold mb-1">Roth Strategy shows "Analysis failed"</p>
            <p>Make sure your scenario has at least one tax-deferred account with a starting balance. The Roth analysis requires tax-deferred funds to model conversions.</p>
          </div>
        </div>
      </Section>

      <p className="font-sans text-slate-600 text-xs text-center mt-6 pb-4">
        Questions? Feedback? Use the thumbs down button on any AI response to send feedback to our team.
      </p>
    </div>
  )
}
