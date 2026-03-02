/**
 * releases.ts
 *
 * Centralized release notes for my-moneyplan.com.
 * Add new entries at the TOP of the array.
 * The dashboard banner shows the most recent release.
 */

export interface ReleaseNote {
  version:  string
  date:     string          // YYYY-MM-DD
  title:    string
  summary:  string          // One line for banner
  features: string[]
  fixes?:   string[]
  tag?:     'new' | 'major' | 'update'
}

export const RELEASES: ReleaseNote[] = [
  {
    version: '1.7.0',
    date:    '2026-03-01',
    title:   'Financial Intelligence Feed',
    summary: 'New: Personalized AI-powered financial insights update every time you log in',
    tag:     'major',
    features: [
      'Financial Intelligence Feed on the dashboard — 6 personalized insight cards refreshed daily via AI web search',
      'Categories: Income Opportunity, Investment Strategy, Tax Strategy, Retirement Planning, Economic Context, Medicare & Benefits',
      'Each card includes current rates and data points, a specific action to take, and a recency indicator',
      'Insights are personalized to your age, portfolio size, tax bracket, state, and employment status',
      'Cards are expandable — click to reveal full insight, action item, and source',
      'Cached for 24 hours with one-click manual refresh',
      'Required name field on income streams for clearer identification across charts and reports',
    ],
  },
  {
    version: '1.6.0',
    date:    '2026-02-28',
    title:   'Roth Strategy & Tax Optimizer',
    summary: 'New: Roth Conversion Strategy tab — model RMD impact and lifetime tax savings',
    tag:     'major',
    features: [
      'Roth Strategy tab in Projection Results — model Roth conversions vs baseline RMD schedule',
      'Auto-optimizes annual conversion amount to fill your target tax bracket (12%, 22%, 24%)',
      'Side-by-side bar charts: current RMDs vs optimized RMDs, current taxes vs optimized taxes',
      'Medicare IRMAA surcharge warnings when conversions exceed income thresholds',
      'Year-by-year detail table with conversion amounts, RMDs, taxes, and annual savings',
      'Uses IRS Uniform Lifetime Table for accurate RMD calculations',
    ],
    fixes: [
      'AI analysis no longer suggests tax-deferred contributions to retired users',
    ],
  },
  {
    version: '1.5.0',
    date:    '2026-02-26',
    title:   'Monte Carlo Analysis',
    summary: 'New: Monte Carlo simulation — see your plan\'s success rate across 1,000 market scenarios',
    tag:     'major',
    features: [
      '1,000 simulations with randomized annual market returns (mean = your assumed rate, std dev = 12%)',
      'Fan chart showing 10th, 25th, 50th, 75th, 90th percentile portfolio outcomes',
      'Headline plan success rate (% of simulations ending with money remaining)',
      'Deterministic projection line overlaid on fan chart for comparison',
      'Ruin probability by age table — % chance of running out at ages 65, 70, 75, 80, 85, 90',
      'Results cached for 24 hours with one-click refresh',
      'Worst case (5th %ile), median, and best case (95th %ile) ending balances',
    ],
  },
  {
    version: '1.4.0',
    date:    '2026-02-24',
    title:   'Plan Health Score & Speedometer',
    summary: 'New: Plan Health Score speedometer on every scenario card',
    tag:     'new',
    features: [
      'Plan Health Score (0–100) on each scenario card with speedometer needle gauge',
      'Hover over speedometer to see full score breakdown with progress bars',
      'Score components: Survival Rate (30pts), Portfolio Growth (20pts), Surplus Cushion (20pts), Contribution Utilization (15pts), Tax Diversification (15pts)',
      'Contribution scoring compares actual contributions to IRS maximums — only penalizes working people',
      'Tax diversification scoring penalizes heavy concentration in any single tax bucket',
      'Color-coded zones: At Risk (red), Needs Work (orange), On Track (yellow), Strong Plan (green)',
    ],
  },
  {
    version: '1.3.0',
    date:    '2026-02-22',
    title:   'Employment Status & Social Security Planning',
    summary: 'New: Employment status and Social Security start date on person profiles',
    tag:     'new',
    features: [
      'Employment status field: Working Full-Time, Part-Time, Self-Employed, Retired, Not Working',
      'Planned retirement date field — shows only for working people',
      'Social Security start date — shows for retired people or those with a planned retirement date',
      'Live countdown: "Starting in 3 years 4 months" or "Already receiving"',
      'AI analysis now references employment status, retirement timeline, and SS start date',
      'AI guardrails: no longer recommends tax-deferred contributions to retired users',
    ],
  },
  {
    version: '1.2.0',
    date:    '2026-02-20',
    title:   'Dashboard Consolidation & Actions',
    summary: 'Dashboard now includes all scenario actions: duplicate, export, delete, and import',
    tag:     'update',
    features: [
      'Duplicate, Export JSON, and Delete actions directly on each scenario card',
      'Import JSON button in dashboard header',
      'Compare scenarios link in header (shows when 2+ scenarios exist)',
      'Removed redundant Scenarios navigation tab',
      'Portfolio sparkline with hover tooltip showing year and value',
      'Scenario cards show income stream type pills and account name pills',
    ],
  },
  {
    version: '1.1.0',
    date:    '2026-02-18',
    title:   'Sankey Chart & Investment Contributions',
    summary: 'Sankey chart now shows investment account contributions as destination nodes',
    tag:     'update',
    features: [
      'Investment accounts with monthly contributions appear as blue nodes on the Sankey chart',
      'Hover info bar above Sankey shows flow details on mouse-over',
      'AI analysis includes age and milestone context: full retirement age, Medicare, RMDs, life expectancy',
      'AI prompt updated with 2025 federal tax rules',
    ],
  },
  {
    version: '1.0.0',
    date:    '2026-02-01',
    title:   'Initial Release',
    summary: 'my-moneyplan.com is live!',
    tag:     'major',
    features: [
      'Month-by-month retirement cash flow projection engine',
      'Income streams: Pension, Social Security, Salary, Self-Employment, Other',
      'Investment accounts with tax bucket tracking (Tax-Deferred, Roth, Taxable)',
      'Federal and state tax calculations (CA and AZ supported)',
      'Executive Summary with Sankey flow chart',
      'AI-powered CFP-level financial analysis via GPT-4o',
      'Annual, Monthly, Net Income, and Tax result tables',
      'Google OAuth authentication',
      'Export and import scenarios as JSON',
      'Scenario comparison view',
    ],
  },
]

export const LATEST_RELEASE = RELEASES[0]
export const LATEST_VERSION = RELEASES[0].version
