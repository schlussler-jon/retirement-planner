/**
 * TaxTable
 *
 * Full annual tax breakdown: SSA taxation, AGI build-up,
 * deduction, bracket application, and effective rate.
 * Horizontally scrollable — all columns are important.
 */

import type { TaxSummary } from '@/types/api'

interface Props {
  data: TaxSummary[]
}

// ─── helpers ──────────────────────────────────────────────────────────────

const fmt    = (n: number) => '$' + Math.round(n).toLocaleString()
const fmtPct = (n: number) => (n * 100).toFixed(1) + '%'

const TH = 'px-4 py-2.5 font-sans text-xs font-semibold text-gold-500 uppercase tracking-wider whitespace-nowrap'
const TD = 'px-4 py-2 font-sans text-sm whitespace-nowrap'

// ─── component ────────────────────────────────────────────────────────────

export default function TaxTable({ data }: Props) {
  if (data.length === 0) {
    return <p className="font-sans text-slate-500 text-sm text-center py-10">No tax data available.</p>
  }

  return (
    <div>
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 520 }}>
        <table className="w-full text-left">

          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-800">
              <th className={`${TH} sticky left-0 bg-slate-800 text-left`}>Year</th>
              <th className={`${TH} text-right`}>SSA Income</th>
              <th className={`${TH} text-right`}>Taxable SSA</th>
              <th className={`${TH} text-right`}>Other Income</th>
              <th className={`${TH} text-right`}>AGI</th>
              <th className={`${TH} text-right`}>Std Deduction</th>
              <th className={`${TH} text-right`}>Taxable Income</th>
              <th className={`${TH} text-right`}>Federal Tax</th>
              <th className={`${TH} text-right`}>State Tax</th>
              <th className={`${TH} text-right`}>Total Tax</th>
              <th className={`${TH} text-right`}>Eff. Rate</th>
            </tr>
          </thead>

          <tbody>
            {data.map((row) => (
              <tr key={row.year} className="border-b border-slate-800/40 hover:bg-slate-800/40 transition-colors">
                <td className={`${TD} text-slate-300 font-mono sticky left-0 bg-slate-900`}>{row.year}</td>

                {/* SSA block */}
                <td className={`${TD} text-slate-300 text-right`}>{fmt(row.total_ssa_income)}</td>
                <td className={`${TD} text-slate-400 text-right`}>{fmt(row.taxable_ssa_income)}</td>

                {/* income build-up */}
                <td className={`${TD} text-slate-300 text-right`}>{fmt(row.other_ordinary_income)}</td>
                <td className={`${TD} text-white text-right`}>{fmt(row.agi)}</td>
                <td className={`${TD} text-slate-400 text-right`}>{fmt(row.standard_deduction)}</td>
                <td className={`${TD} text-white text-right`}>{fmt(row.taxable_income)}</td>

                {/* tax output */}
                <td className={`${TD} text-slate-400 text-right`}>{fmt(row.federal_tax)}</td>
                <td className={`${TD} text-slate-400 text-right`}>{fmt(row.state_tax)}</td>
                <td className={`${TD} text-white font-semibold text-right`}>{fmt(row.total_tax)}</td>
                <td className={`${TD} text-slate-300 text-right`}>{fmtPct(row.effective_tax_rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-sans text-slate-600 text-xs px-4 py-2 border-t border-slate-800">
        {data.length} years · SSA taxation uses the IRS provisional-income method
      </p>
    </div>
  )
}
