/**
 * ExpensePieChart
 * 
 * Visualizes budget spending breakdown by category
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import type { BudgetCategory } from '@/types/scenario'

interface Props {
  categories: BudgetCategory[]
}

// Professional color palette (10 distinct colors for categories)
const COLORS = [
  '#D4AF37', // Gold
  '#4ECDC4', // Teal
  '#FF6B6B', // Coral
  '#95E1D3', // Mint
  '#FFA07A', // Light Salmon
  '#98D8C8', // Aquamarine
  '#F7DC6F', // Yellow
  '#BB8FCE', // Purple
  '#85C1E2', // Sky Blue
  '#F8B739', // Amber
]

const formatCurrency = (value: number) => {
  return '$' + Math.round(value).toLocaleString()
}

export default function ExpensePieChart({ categories }: Props) {
  // Group by main category and sum amounts
  const categoryTotals = new Map<string, number>()
  
  if (!categories || !Array.isArray(categories)) {
    categories = []
  }
  
  categories.forEach(cat => {
    if (!cat.include) return
    const current = categoryTotals.get(cat.main_category) || 0
    categoryTotals.set(cat.main_category, current + cat.monthly_amount)
  })

  // Convert to array for chart
  const data = Array.from(categoryTotals.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value) // Sort by size

  const totalSpending = data.reduce((sum, item) => sum + item.value, 0)

  if (data.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="font-sans text-slate-300 text-lg font-semibold mb-4">
          Spending by Category
        </h3>
        <p className="font-sans text-slate-500 text-sm text-center py-8">
          No budget categories defined yet
        </p>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-sans text-slate-300 text-lg font-semibold">
          Spending by Category
        </h3>
        <p className="font-sans text-slate-500 text-sm">
          Total: <span className="text-white font-semibold">{formatCurrency(totalSpending)}/mo</span>
        </p>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#fff'
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value, entry: any) => (
              <span className="font-sans text-xs text-slate-400">
                {value}: {formatCurrency(entry.payload.value)}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
