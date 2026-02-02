/**
 * SummaryCards
 *
 * Four at-a-glance cards pulled from the FinancialSummary + portfolio
 * start/end values.  The cumulative surplus/deficit card gets a
 * coloured border to draw the eye.
 */

import type { FinancialSummary } from '@/types/api'

interface Props {
  summary:            FinancialSummary
  startingPortfolio:  number
  endingPortfolio:    number
  totalMonths:        number
}

const fmt = (n: number) => '$' + Math.round(Math.abs(n)).toLocaleString()

export default function SummaryCards({ summary, startingPortfolio, endingPortfolio, totalMonths }: Props) {
  const totalPositive  = summary.total_surplus_deficit >= 0
  const avgPositive    = summary.average_monthly_surplus_deficit >= 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">

      {/* 1 – Ending Portfolio */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-4">
        <p className="font-sans text-slate-500 text-xs uppercase tracking-wider mb-1.5">Ending Portfolio</p>
        <p className="font-sans text-white text-2xl font-semibold">{fmt(endingPortfolio)}</p>
        <p className="font-sans text-slate-600 text-xs mt-1">
          {endingPortfolio >= startingPortfolio ? '▲' : '▼'} started at {fmt(startingPortfolio)}
        </p>
      </div>

      {/* 2 – Cumulative Surplus / Deficit (highlighted card) */}
      <div className={`bg-slate-900 border rounded-xl px-4 py-4 ${totalPositive ? 'border-success/25' : 'border-danger/25'}`}>
        <p className="font-sans text-slate-500 text-xs uppercase tracking-wider mb-1.5">
          Cumulative {totalPositive ? 'Surplus' : 'Deficit'}
        </p>
        <p className={`font-sans text-2xl font-semibold ${totalPositive ? 'text-success' : 'text-danger'}`}>
          {totalPositive ? '' : '−'}{fmt(summary.total_surplus_deficit)}
        </p>
        <p className="font-sans text-slate-600 text-xs mt-1">over {totalMonths} months</p>
      </div>

      {/* 3 – Avg Monthly Surplus / Deficit */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-4">
        <p className="font-sans text-slate-500 text-xs uppercase tracking-wider mb-1.5">Avg Monthly</p>
        <p className={`font-sans text-2xl font-semibold ${avgPositive ? 'text-success' : 'text-danger'}`}>
          {avgPositive ? '' : '−'}{fmt(summary.average_monthly_surplus_deficit)}
        </p>
        <p className="font-sans text-slate-600 text-xs mt-1">surplus / month</p>
      </div>

      {/* 4 – Months in Surplus vs Deficit */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-4">
        <p className="font-sans text-slate-500 text-xs uppercase tracking-wider mb-1.5">Months Overview</p>
        <p className="font-sans text-2xl font-semibold">
          <span className="text-success">{summary.months_in_surplus}</span>
          <span className="text-slate-600 mx-1.5 text-base">/</span>
          <span className="text-danger">{summary.months_in_deficit}</span>
        </p>
        <p className="font-sans text-slate-600 text-xs mt-1">
          <span className="text-success">surplus</span> · <span className="text-danger">deficit</span>
        </p>
      </div>
    </div>
  )
}
