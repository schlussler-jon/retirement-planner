/**
 * AnnualTable
 *
 * Year-by-year rollup.  Joins annual_summaries (income + portfolio)
 * with tax_summaries (total tax + effective rate) by year so every
 * row carries the full picture.
 */

import type { AnnualSummary, TaxSummary } from '@/types/api'

interface Props {
  annuals: AnnualSummary[]
  taxes:   TaxSummary[]
}

// ─── helpers ──────────────────────────────────────────────────────────────

const fmt    = (n: number) => '$' + Math.round(n).toLocaleString()
const fmtPct = (n: number) => (n * 100).toFixed(1) + '%'

const TH = 'px-4 py-2.5 font-sans text-xs font-semibold text-gold-500 uppercase tracking-wider whitespace-nowrap'
const TD = 'px-4 py-2 font-sans text-sm whitespace-nowrap'

// ─── component ────────────────────────────────────────────────────────────

export default function AnnualTable({ annuals, taxes }: Props) {
  // index taxes by year for O(1) lookup
  const taxByYear = new Map<number, TaxSummary>(taxes.map(t => [t.year, t]))

  if (annuals.length === 0) {
    return <p className="font-sans text-slate-500 text-sm text-center py-10">No annual data available.</p>
  }

  return (
    <div>
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 520 }}>
        <table className="w-full text-left">

          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-800">
              <th className={`${TH} sticky left-0 bg-slate-800 text-left`}>Year</th>
              <th className={`${TH} text-right`}>Total Income</th>
              <th className={`${TH} text-right`}>Total Tax</th>
              <th className={`${TH} text-right`}>Eff. Rate</th>
              <th className={`${TH} text-right`}>End Portfolio</th>
            </tr>
          </thead>

          <tbody>
            {annuals.map((row) => {
              const tax = taxByYear.get(row.year)
              return (
                <tr key={row.year} className="border-b border-slate-800/40 hover:bg-slate-800/40 transition-colors">
                  <td className={`${TD} text-slate-300 font-mono sticky left-0 bg-slate-900`}>{row.year}</td>
                  <td className={`${TD} text-white text-right`}>{fmt(row.total_income_year)}</td>
                  <td className={`${TD} text-slate-400 text-right`}>{tax ? fmt(tax.total_tax) : '—'}</td>
                  <td className={`${TD} text-slate-400 text-right`}>{tax ? fmtPct(tax.effective_tax_rate) : '—'}</td>
                  <td className={`${TD} text-white text-right`}>{fmt(row.end_of_year_total_investments)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="font-sans text-slate-600 text-xs px-4 py-2 border-t border-slate-800">
        {annuals.length} years
      </p>
    </div>
  )
}
