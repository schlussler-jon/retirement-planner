/**
 * NetIncomeTable
 *
 * The primary output table.  Monthly rows: gross → taxes → net → spending → surplus.
 * Surplus/deficit column is colour-coded.  Month column is sticky-left so it
 * stays visible when scrolling horizontally on narrow screens.
 */

import type { NetIncomeProjection } from '@/types/api'

interface Props {
  data: NetIncomeProjection[]
}

// ─── helpers ──────────────────────────────────────────────────────────────

const fmt  = (n: number) => '$' + Math.round(n).toLocaleString()
const sign = (n: number) => (n >= 0 ? '' : '−') + '$' + Math.round(Math.abs(n)).toLocaleString()

// ─── shared cell classes ──────────────────────────────────────────────────

const TH = 'px-4 py-2.5 font-sans text-xs font-semibold text-gold-500 uppercase tracking-wider whitespace-nowrap'
const TD = 'px-4 py-2 font-sans text-sm whitespace-nowrap'

// ─── component ────────────────────────────────────────────────────────────

export default function NetIncomeTable({ data }: Props) {
  if (data.length === 0) {
    return <p className="font-sans text-slate-500 text-sm text-center py-10">No net-income data available.</p>
  }

  return (
    <div>
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 520 }}>
        <table className="w-full text-left">

          {/* sticky header */}
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-800">
              <th className={`${TH} sticky left-0 bg-slate-800 text-left`}>Month</th>
              <th className={`${TH} text-right`}>Gross</th>
              <th className={`${TH} text-right`}>Fed Tax</th>
              <th className={`${TH} text-right`}>State Tax</th>
              <th className={`${TH} text-right`}>Net Income</th>
              <th className={`${TH} text-right`}>Spending</th>
              <th className={`${TH} text-right`}>Surplus / Deficit</th>
            </tr>
          </thead>

          <tbody>
            {data.map((row) => (
              <tr key={row.month} className="border-b border-slate-800/40 hover:bg-slate-800/40 transition-colors">
                {/* sticky month */}
                <td className={`${TD} text-slate-300 font-mono sticky left-0 bg-slate-900`}>{row.month}</td>

                <td className={`${TD} text-white text-right`}>{fmt(row.gross_cashflow)}</td>
                <td className={`${TD} text-slate-400 text-right`}>{fmt(row.estimated_federal_tax)}</td>
                <td className={`${TD} text-slate-400 text-right`}>{fmt(row.estimated_state_tax)}</td>
                <td className={`${TD} text-white text-right`}>{fmt(row.net_income_after_tax)}</td>
                <td className={`${TD} text-slate-300 text-right`}>
                  {fmt(row.survivor_spending_applied ?? row.inflation_adjusted_spending)}
                </td>

                {/* surplus / deficit – colour-coded */}
                <td className={`${TD} font-semibold text-right ${row.surplus_deficit >= 0 ? 'text-success' : 'text-danger'}`}>
                  {sign(row.surplus_deficit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* footer */}
      <p className="font-sans text-slate-600 text-xs px-4 py-2 border-t border-slate-800">
        {data.length} months · spending column shows survivor-adjusted amount when applicable
      </p>
    </div>
  )
}
