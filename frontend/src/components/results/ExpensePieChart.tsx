// Safety checks for undefined categories

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

interface BudgetCategory {
  category_name: string
  main_category: string
  monthly_amount: number
  include: boolean
}

interface Props {
  categories: BudgetCategory[]
}

// One distinct color per category
const CATEGORY_COLORS: Record<string, string> = {
  'Housing': '#FFD700',          // Bright gold
  'Transportation': '#00CED1',   // Dark turquoise
  'Food': '#FF6347',             // Tomato
  'Healthcare': '#3CB371',       // Medium sea green
  'Entertainment': '#FF69B4',    // Hot pink
  'Personal': '#9370DB',         // Medium purple
  'Utilities': '#FFA500',        // Orange
  'Insurance': '#4169E1',        // Royal blue
  'Savings': '#32CD32',          // Lime green
  'Other': '#D2691E',            // Chocolate
}

const formatCurrency = (value: number) => {
  return '$' + Math.round(value).toLocaleString()
}

export default function ExpensePieChart({ categories }: Props) {
  if (!categories || !Array.isArray(categories)) {
    categories = []
  }
  
  const data = categories
    .filter(cat => cat.include && cat.monthly_amount > 0)
    .map(cat => ({
      name: cat.category_name,
      value: cat.monthly_amount,
      color: CATEGORY_COLORS[cat.main_category] || CATEGORY_COLORS['Other'],
      category: cat.main_category
    }))
    .sort((a, b) => b.value - a.value)  // Sort by amount descending

  const total = data.reduce((sum, item) => sum + item.value, 0)

  if (data.length === 0) {
    return (
      <div className="bg-slate-900 rounded-lg p-6">
        <h3 className="font-sans text-lg font-semibold text-white mb-4">Monthly Expenses</h3>
        <p className="font-sans text-slate-500 text-sm">No expense data available</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 rounded-lg p-6">
      <h3 className="font-sans text-lg font-semibold text-white mb-2">Monthly Expenses</h3>
      <p className="font-sans text-slate-400 text-sm mb-4">Total: {formatCurrency(total)}/month</p>
      
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
            formatter={(value: number) => formatCurrency(value)}
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
            formatter={(value, entry: any) => `${value} - ${formatCurrency(entry.payload.value)}`}
            wrapperStyle={{ fontSize: '10px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
