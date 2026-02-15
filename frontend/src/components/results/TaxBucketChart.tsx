// Safety checks for undefined accounts

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

interface InvestmentAccount {
  name: string
  starting_balance: number
  tax_bucket: 'taxable' | 'tax_deferred' | 'roth'
}

interface Props {
  accounts: InvestmentAccount[]
}

// Tax bucket colors
const TAX_BUCKET_COLORS: Record<string, string> = {
  'taxable': '#4ECDC4',        // Teal
  'tax_deferred': '#FFD700',   // Gold
  'roth': '#32CD32',           // Lime green
}

const TAX_BUCKET_LABELS: Record<string, string> = {
  'taxable': 'Taxable',
  'tax_deferred': 'Tax-Deferred',
  'roth': 'Roth',
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return '$' + (value / 1000000).toFixed(2) + 'M'
  }
  if (value >= 1000) {
    return '$' + (value / 1000).toFixed(0) + 'K'
  }
  return '$' + value.toFixed(0)
}

export default function TaxBucketChart({ accounts }: Props) {
  if (!accounts || !Array.isArray(accounts)) {
    accounts = []
  }

  const data = accounts
    .filter(acc => acc.starting_balance > 0)
    .map(acc => ({
      name: acc.name,
      value: acc.starting_balance,
      color: TAX_BUCKET_COLORS[acc.tax_bucket],
      bucket: TAX_BUCKET_LABELS[acc.tax_bucket]
    }))
    .sort((a, b) => b.value - a.value)  // Sort by balance descending

  const total = data.reduce((sum, item) => sum + item.value, 0)

  if (data.length === 0) {
    return (
      <div className="bg-slate-900 rounded-lg p-6">
        <h3 className="font-sans text-lg font-semibold text-white mb-4">Tax Bucket Distribution</h3>
        <p className="font-sans text-slate-500 text-sm">No investment accounts</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 rounded-lg p-6">
      <h3 className="font-sans text-lg font-semibold text-white mb-2">Tax Bucket Distribution</h3>
      <p className="font-sans text-slate-400 text-sm mb-4">Total: {formatCurrency(total)}</p>
      
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number, name: string, entry: any) => [
              formatCurrency(value),
              `${entry.payload.name} (${entry.payload.bucket})`
            ]}
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid #475569',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '11px'
            }}
            labelStyle={{ color: '#e2e8f0' }}
            itemStyle={{ color: '#fff' }}
          />
          <Legend 
            formatter={(value, entry: any) => `${value} (${entry.payload.bucket}) - ${formatCurrency(entry.payload.value)}`}
            wrapperStyle={{ fontSize: '10px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
