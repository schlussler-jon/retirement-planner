import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface SectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

function Section({ title, children, defaultOpen = false }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border border-slate-700 rounded-lg mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800 transition-colors"
      >
        <h2 className="font-sans text-lg font-semibold text-white">{title}</h2>
        {isOpen ? (
          <ChevronDown className="text-slate-400" size={20} />
        ) : (
          <ChevronRight className="text-slate-400" size={20} />
        )}
      </button>
      {isOpen && (
        <div className="p-4 pt-0 border-t border-slate-700 mt-2">
          <div className="prose prose-invert prose-sm max-w-none">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Help() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 px-8 py-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-sans text-3xl font-bold text-white mb-2">Help & Documentation</h1>
          <p className="font-sans text-slate-400">
            Learn how to use the Retirement Planner to create and analyze your financial future
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-8 py-8">
        
        <Section title="Getting Started" defaultOpen={true}>
          <h3 className="text-white text-base font-semibold mb-2">Welcome to the Retirement Planner!</h3>
          <p className="text-slate-300 text-sm mb-3">
            This tool helps you model your retirement by projecting income, expenses, taxes, and investment growth
            over time. You can create multiple scenarios to test different assumptions and strategies.
          </p>

          <h4 className="text-white text-sm font-semibold mb-2">Quick Start Steps:</h4>
          <ol className="text-slate-300 text-sm list-decimal list-inside mb-3 space-y-1">
            <li>Click <strong>Scenarios</strong> in the top navigation</li>
            <li>Click <strong>+ New Scenario</strong></li>
            <li>Fill out each tab: Settings, People, Income, Accounts, Budget</li>
            <li>Click <strong>Save Scenario</strong></li>
            <li>Click <strong>View Results</strong> to run your projection</li>
          </ol>

          <h4 className="text-white text-sm font-semibold mb-2">Storage Options:</h4>
          <ul className="text-slate-300 text-sm list-disc list-inside mb-3 space-y-1">
            <li><strong>LocalStorage</strong>: Saved in your browser. Persists until you clear cache.</li>
            <li><strong>In Memory</strong>: Saved on server. Cleared when server restarts.</li>
          </ul>
          <p className="text-amber-400 text-sm">
            💡 Tip: Export your scenarios as JSON to keep backups!
          </p>
        </Section>

        <Section title="Settings & Timeline">
          <h3 className="text-white text-base font-semibold mb-2">Configure Your Projection</h3>
          
          <h4 className="text-white text-sm font-semibold mb-2">Projection Start Month</h4>
          <p className="text-slate-300 text-sm mb-3">
            When to begin the projection (e.g., <code className="text-amber-400">2026-01</code> for January 2026). This is typically today's
            date or when you plan to retire.
          </p>

          <h4 className="text-white text-sm font-semibold mb-2">Projection End Year</h4>
          <p className="text-slate-300 text-sm mb-3">
            How far into the future to project (e.g., <code className="text-amber-400">2075</code>). Choose a year beyond your expected
            lifespan to ensure you don't outlive your savings. 30-50 year projections are common.
          </p>

          <h4 className="text-white text-sm font-semibold mb-2">Residence State</h4>
          <p className="text-slate-300 text-sm mb-3">
            Your state for tax calculations. Enter the 2-letter code (e.g., <code className="text-amber-400">AZ</code> for Arizona,
            <code className="text-amber-400">CA</code> for California). State income tax is calculated based on your state's brackets.
          </p>
          <p className="text-amber-400 text-sm">
            💡 Currently supported: Arizona (AZ), California (CA). More states coming soon!
          </p>
        </Section>

        <Section title="People">
          <h3 className="text-white text-base font-semibold mb-2">Household Members</h3>
          <p className="text-slate-300 text-sm mb-3">
            Add everyone in your household. People are linked to income streams (pensions, Social Security)
            and used for tax filing status calculations.
          </p>

          <h4 className="text-white text-sm font-semibold mb-2">Required Fields:</h4>
          <ul className="text-slate-300 text-sm list-disc list-inside mb-3 space-y-1">
            <li><strong>Name</strong>: First name or nickname</li>
            <li><strong>Birth Year</strong>: Four-digit year (e.g., 1970)</li>
          </ul>

          <h4 className="text-white text-sm font-semibold mb-2">Example:</h4>
          <ul className="text-slate-300 text-sm list-disc list-inside mb-3 space-y-1">
            <li>Person 1: Rebecca, born 1970</li>
            <li>Person 2: Jon, born 1968</li>
          </ul>

          <p className="text-amber-400 text-sm">
            💡 Tip: Ages are used to determine Social Security eligibility and RMD calculations.
          </p>
        </Section>

        <Section title="Income Streams">
          <h3 className="text-white text-base font-semibold mb-2">All Your Sources of Income</h3>
          <p className="text-slate-300 text-sm mb-3">
            Model all income sources: pensions, Social Security, salary, rental income, etc. Each stream can
            have different start/end dates, amounts, and cost-of-living adjustments (COLA).
          </p>

          <h4 className="text-white text-sm font-semibold mb-2">Income Types:</h4>
          <ul className="text-slate-300 text-sm list-disc list-inside mb-3 space-y-1">
            <li><strong>Pension</strong>: Employer pension or annuity payments</li>
            <li><strong>Social Security</strong>: SSA retirement benefits</li>
            <li><strong>Salary</strong>: W-2 wages from employment</li>
            <li><strong>Self Employment</strong>: 1099 income from freelance/business</li>
            <li><strong>Other</strong>: Rental income, royalties, dividends, etc.</li>
          </ul>

          <p className="text-amber-400 text-sm">
            💡 Tip: Delay Social Security to 70 for maximum benefits! Each year of delay increases payments ~8%.
          </p>
        </Section>

        <Section title="Investment Accounts">
          <h3 className="text-white text-base font-semibold mb-2">Retirement & Brokerage Accounts</h3>
          <p className="text-slate-300 text-sm mb-3">
            Add all your investment accounts: 401(k), IRA, Roth IRA, brokerage, etc. The system tracks balances,
            applies growth, and models contributions/withdrawals over time.
          </p>

          <h4 className="text-white text-sm font-semibold mb-2">Tax Bucket Types:</h4>
          <ul className="text-slate-300 text-sm list-disc list-inside mb-3 space-y-1">
            <li><strong>Taxable</strong>: Regular brokerage accounts</li>
            <li><strong>Tax-Deferred</strong>: 401(k), Traditional IRA - withdrawals are fully taxed</li>
            <li><strong>Roth</strong>: Roth IRA, Roth 401(k) - qualified withdrawals are tax-free</li>
          </ul>

          <p className="text-amber-400 text-sm">
            💡 Tip: Diversify across tax buckets for tax flexibility in retirement!
          </p>
        </Section>

        <Section title="Budget & Expenses">
          <h3 className="text-white text-base font-semibold mb-2">Your Monthly Spending</h3>
          <p className="text-slate-300 text-sm mb-3">
            Model all your expenses: housing, utilities, food, healthcare, etc. Each expense can have its own
            inflation rate and optional start/end dates.
          </p>

          <p className="text-amber-400 text-sm">
            💡 Tip: Use realistic inflation rates! Food/healthcare typically 3-4%, utilities 2-3%.
          </p>
        </Section>

        <Section title="Understanding Results">
          <h3 className="text-white text-base font-semibold mb-2">Interpreting Your Projection</h3>
          <p className="text-slate-300 text-sm mb-3">
            Results are displayed in three tabs: Charts, Tables, and Executive Summary.
          </p>

          <h4 className="text-white text-sm font-semibold mb-2">Key Metrics to Watch:</h4>
          <ul className="text-slate-300 text-sm list-disc list-inside mb-3 space-y-1">
            <li>✅ <strong>Positive Ending Portfolio</strong>: You don't run out of money</li>
            <li>✅ <strong>Positive Average Cash Flow</strong>: Building wealth over time</li>
            <li>⚠️ <strong>Negative Ending Portfolio</strong>: May outlive savings</li>
          </ul>
        </Section>

        <Section title="Executive Summary">
          <h3 className="text-white text-base font-semibold mb-2">Professional Dashboard View</h3>
          
          <h4 className="text-white text-sm font-semibold mb-2">Sankey Diagram Guide:</h4>
          <p className="text-slate-300 text-sm mb-2"><strong>Left Side (Income Sources):</strong></p>
          <ul className="text-slate-300 text-sm list-disc list-inside mb-3 space-y-1">
            <li>🟣 Purple = Pensions</li>
            <li>🔵 Teal = Social Security</li>
            <li>🟡 Yellow = Other income</li>
          </ul>

          <p className="text-slate-300 text-sm mb-2"><strong>Right Side (Where It Goes):</strong></p>
          <ul className="text-slate-300 text-sm list-disc list-inside mb-3 space-y-1">
            <li>🔴 Red = Federal & State Taxes</li>
            <li>🟨 Gold = Individual Expenses</li>
            <li>🟢 Green = Net Savings</li>
          </ul>
        </Section>

        <Section title="Tips & Best Practices">
          <h3 className="text-white text-base font-semibold mb-2">Get the Most Out of the Planner</h3>

          <h4 className="text-white text-sm font-semibold mb-2">Income Planning:</h4>
          <ul className="text-slate-300 text-sm list-disc list-inside mb-3 space-y-1">
            <li>Model Social Security at different claiming ages (62, 67, 70)</li>
            <li>Use realistic COLA rates: 2-3% for pensions</li>
          </ul>

          <h4 className="text-white text-sm font-semibold mb-2">Investment Strategy:</h4>
          <ul className="text-slate-300 text-sm list-disc list-inside mb-3 space-y-1">
            <li>Use conservative returns: 5-6% for balanced portfolios</li>
            <li>Diversify across tax buckets</li>
          </ul>
        </Section>

        <Section title="Troubleshooting">
          <h3 className="text-white text-base font-semibold mb-2">Common Issues & Solutions</h3>

          <div className="mb-4">
            <h4 className="text-white text-sm font-semibold mb-1">Can't Save Scenario</h4>
            <p className="text-slate-300 text-sm">
              <strong>Solution:</strong> Make sure all required fields are filled. Account names are required.
            </p>
          </div>

          <div className="mb-4">
            <h4 className="text-white text-sm font-semibold mb-1">Charts Not Loading</h4>
            <p className="text-slate-300 text-sm">
              <strong>Solution:</strong> Hard refresh (Ctrl+Shift+R or Cmd+Shift+R). Clear browser cache.
            </p>
          </div>

          <div className="mb-4">
            <h4 className="text-white text-sm font-semibold mb-1">"Undefined" in Charts</h4>
            <p className="text-slate-300 text-sm">
              <strong>Solution:</strong> Make sure you entered names for all accounts. Re-save and refresh.
            </p>
          </div>
        </Section>

        <Section title="FAQs">
          <h3 className="text-white text-base font-semibold mb-2">Frequently Asked Questions</h3>

          <div className="mb-4">
            <h4 className="text-white text-sm font-semibold mb-1">Q: Is my data secure?</h4>
            <p className="text-slate-300 text-sm">
              <strong>A:</strong> LocalStorage data stays in your browser. In-Memory data is session-based.
              We don't permanently store your financial data.
            </p>
          </div>

          <div className="mb-4">
            <h4 className="text-white text-sm font-semibold mb-1">Q: What return rate should I use?</h4>
            <p className="text-slate-300 text-sm">
              <strong>A:</strong> Conservative: 4-5%. Moderate: 6-7%. Most planners recommend 5-6% for
              balanced portfolios in retirement.
            </p>
          </div>

          <div className="mb-4">
            <h4 className="text-white text-sm font-semibold mb-1">Q: Can I model part-time work in retirement?</h4>
            <p className="text-slate-300 text-sm">
              <strong>A:</strong> Yes! Add a Salary income stream with a start date and end date.
            </p>
          </div>
        </Section>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-slate-700 text-center">
          <p className="font-sans text-slate-500 text-sm">
            Need more help? Found a bug? Have a feature request?
          </p>
          <p className="font-sans text-slate-400 text-sm mt-2">
            Contact: <span className="text-blue-400">support@retirementplanner.com</span>
          </p>
          <p className="font-sans text-slate-600 text-xs mt-4">
            Version: Beta 1.0 | Last Updated: February 2026
          </p>
        </div>
      </div>
    </div>
  )
}