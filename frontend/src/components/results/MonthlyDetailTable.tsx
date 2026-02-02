/**
 * MonthlyDetailTable
 *
 * Split into two sub-views so neither one overflows:
 *
 *   Income   → Month | [stream columns] | Total Income
 *   Accounts → Month | [balance columns] | Withdrawals | Portfolio
 *
 * Stream labels are generated from the scenario (type + owner).
 * Account labels come from account.name.
 * Month column is sticky-left in both views.
 */

import { useState } from 'react'
import type { MonthlyProjection } from '@/types/api'
import type { Scenario }          from '@/types/scenario'
import { INCOME_STREAM_TYPES }    from '@/types/scenario'

// ─── types ────────────────────────────────────────────────────────────────

interface Props {
  data:     MonthlyProjection[]
  scenario: Scenario | null
}

type SubView = 'Income' | 'Accounts'

// ─── helpers ──────────────────────────────────────────────────────────────

const fmt = (n: number) => '$' + Math.round(n).toLocaleString()

const TH = 'px-4 py-2.5 font-sans text-xs font-semibold text-gold-500 uppercase tracking-wider whitespace-nowrap'
const TD = 'px-4 py-2 font-sans text-sm whitespace-nowrap'

function buildStreamLabels(scenario: Scenario | null): Map<string, string> {
  if (!scenario) return new Map()
  const personName = new Map(scenario.people.map(p => [p.person_id, p.name]))
  return new Map(
    scenario.income_streams.map(s => {
      const typeName = INCOME_STREAM_TYPES.find(t => t.value === s.type)?.label ?? s.type
      const owner    = personName.get(s.owner_person_id) ?? s.owner_person_id
      return [s.stream_id, `${typeName} – ${owner}`]
    })
  )
}

// ─── component ────────────────────────────────────────────────────────────

export default function MonthlyDetailTable({ data, scenario }: Props) {
  const [subView, setSubView] = useState<SubView>('Income')

  if (data.length === 0) {
    return <p className="font-sans text-slate-500 text-sm text-center py-10">No monthly data available.</p>
  }

  const streamKeys  = Object.keys(data[0].income_by_stream)
  const streamNames = buildStreamLabels(scenario)
  const accountKeys = Object.keys(data[0].balances_by_account)

  return (
    <div>
      {/* ── sub-view toggle ───────────────────────────────────────────── */}
      <div className="flex gap-1 p-3 border-b border-slate-800">
        {(['Income', 'Accounts'] as SubView[]).map(v => (
          <button
            key={v}
            onClick={() => setSubView(v)}
            className={`
              font-sans text-xs font-semibold px-3 py-1.5 rounded-lg
              transition-colors duration-150
              ${subView === v
                ? 'bg-slate-800 text-gold-500'
                : 'text-slate-500 hover:text-slate-300'
              }
            `}
          >
            {v}
          </button>
        ))}
      </div>

      {/* ── scrollable table ──────────────────────────────────────────── */}
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 520 }}>
        <table className="w-full text-left">

          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-800">
              {/* sticky month — present in both views */}
              <th className={`${TH} sticky left-0 bg-slate-800 text-left`}>Month</th>

              {subView === 'Income' ? (
                <>
                  {streamKeys.map(key => (
                    <th key={key} className={`${TH} text-right`}>
                      {streamNames.get(key) ?? key}
                    </th>
                  ))}
                  <th className={`${TH} text-right border-l border-slate-700`}>Total Income</th>
                </>
              ) : (
                <>
                  {accountKeys.map(key => {
                    const acct = scenario?.accounts.find(a => a.account_id === key)
                    return (
                      <th key={key} className={`${TH} text-right`}>
                        {acct?.name ?? key}
                      </th>
                    )
                  })}
                  <th className={`${TH} text-right border-l border-slate-700`}>Withdrawals</th>
                  <th className={`${TH} text-right border-l border-slate-700`}>Portfolio</th>
                </>
              )}
            </tr>
          </thead>

          <tbody>
            {data.map((row) => {
              const totalIncome      = Object.values(row.income_by_stream).reduce((a, b) => a + b, 0)
              const totalWithdrawals = Object.values(row.withdrawals_by_account).reduce((a, b) => a + b, 0)

              return (
                <tr key={row.month} className="border-b border-slate-800/40 hover:bg-slate-800/40 transition-colors">
                  {/* sticky month */}
                  <td className={`${TD} text-slate-300 font-mono sticky left-0 bg-slate-900`}>{row.month}</td>

                  {subView === 'Income' ? (
                    <>
                      {streamKeys.map(key => (
                        <td key={key} className={`${TD} text-slate-300 text-right`}>
                          {row.income_by_stream[key] ? fmt(row.income_by_stream[key]) : '—'}
                        </td>
                      ))}
                      <td className={`${TD} text-white font-semibold text-right border-l border-slate-800`}>
                        {fmt(totalIncome)}
                      </td>
                    </>
                  ) : (
                    <>
                      {accountKeys.map(key => (
                        <td key={key} className={`${TD} text-slate-300 text-right`}>
                          {row.balances_by_account[key] ? fmt(row.balances_by_account[key]) : '—'}
                        </td>
                      ))}
                      <td className={`${TD} text-slate-400 font-semibold text-right border-l border-slate-800`}>
                        {totalWithdrawals ? fmt(totalWithdrawals) : '—'}
                      </td>
                      <td className={`${TD} text-white font-semibold text-right border-l border-slate-800`}>
                        {fmt(row.total_investments)}
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* footer */}
      <p className="font-sans text-slate-600 text-xs px-4 py-2 border-t border-slate-800">
        {data.length} months · {subView === 'Income'
          ? 'income by stream'
          : 'per-account balances, total monthly withdrawals, and portfolio total'}
      </p>
    </div>
  )
}
