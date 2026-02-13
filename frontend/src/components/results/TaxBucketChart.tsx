/**
 * TaxBucketChart
 * 
 * Visualizes investment accounts by tax treatment
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { InvestmentAccount } from '@/types/scenario'

interface Props {
  accounts: InvestmentAccount[]
}

const BUCKET_COLORS = {
  taxable: '#4ECDC4',      // Teal
  tax_deferred: '#D4AF37', // Gold
  roth: '#95E1D3',         // Mint
}

const BUCKET_LABELS = {
  taxable: 'Taxable (Brokerage)',
  tax_deferred: 'Tax-Deferred (401k/IRA)',
  roth: 'Tax-Free (Roth)',
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return '$' + (value / 1000000).toFixed(1) + 'M'
  }
  if (value >= 1000) {
    return '$' + (value / 1000).toFixed(0) + 'K'
  }
  return '$' + value.toFixed(0)
}

export default function TaxBucketChart({ accounts }: Props) {
  // Group accounts by tax bucket
  const bucketTotals = {
    taxable: 0,
    tax_deferred: 0,
    roth: 0,
  }

  if (!accounts || !Array.isArray(accounts)) {
    accounts = []
  }

  accounts.forEach(acc => {
    bucketTotals[acc.tax_bucket] += acc.starting_balance
  })

  // Convert to array for chart
  const data = [
    { name: 'Taxable', value: bucketTotals.taxable, bucket: 'taxable' },
    { name: 'Tax-Deferred', value: bucketTotals.tax_deferred, bucket: 'tax_deferred' },
    { name: 'Roth', value: bucketTotals.roth, bucket: 'roth' },
  ].filter(item => item.value > 0) // Only show buckets with balances

  const totalBalance = data.reduce((sum, item) => sum + item.value, 0)

  if (data.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="font-sans text-slate-300 text-lg font-semibold mb-4">
          Tax Bucket Distribution
        </h3>
        <p className="font-sans text-slate-500 text-sm text-center py-8">
          No investment accounts defined yet
        </p>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-sans text-slate-300 text-lg font-semibold">
          Tax Bucket Distribution
        </h3>
        <p className="font-sans text-slate-500 text-sm">
          Total: <span className="text-white font-semibold">{formatCurrency(totalBalance)}</span>
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis 
            type="number" 
            tickFormatter={formatCurrency}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
          />
          <YAxis 
            type="category" 
            dataKey="name"
            width={150}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#fff'
            }}
          />
          <Bar dataKey="value" radius={[0, 8, 8, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={BUCKET_COLORS[entry.bucket as keyof typeof BUCKET_COLORS]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Percentage breakdown */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {data.map(item => (
          <div key={item.bucket} className="text-center">
            <div 
              className="h-2 rounded-full mb-1"
              style={{ 
                backgroundColor: BUCKET_COLORS[item.bucket as keyof typeof BUCKET_COLORS],
                width: `${(item.value / totalBalance) * 100}%`,
                margin: '0 auto'
              }}
            />
            <p className="font-sans text-xs text-slate-400">
              {((item.value / totalBalance) * 100).toFixed(1)}%
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
