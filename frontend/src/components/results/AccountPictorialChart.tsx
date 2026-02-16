/**
 * AccountPictorialChart
 * 
 * Pictorial coin stack visualization - each coin represents a dollar amount
 */

import { useState } from 'react'
import type { InvestmentAccount } from '@/types/scenario'

interface Props {
  accounts: InvestmentAccount[]
  balances: Record<string, number>
}

export default function AccountPictorialChart({ accounts, balances }: Props) {
  const [hoveredCoin, setHoveredCoin] = useState<{ account: string; coinIndex: number } | null>(null)

  // Calculate total portfolio
  const totalPortfolio = Object.values(balances).reduce((sum, val) => sum + val, 0)

  // Determine coin value based on largest account
  const maxBalance = Math.max(...Object.values(balances))
  const coinValue = maxBalance > 2000000 ? 100000 : maxBalance > 500000 ? 50000 : 25000

  // Prepare data
  const chartData = accounts.map(account => ({
    name: account.name,
    value: balances[account.account_id] || 0,
    taxBucket: account.tax_bucket,
    returnRate: (account.annual_return_rate * 100).toFixed(1),
    numCoins: Math.ceil((balances[account.account_id] || 0) / coinValue)
  })).filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value)

  // Tax bucket colors for coins
  const getCoinColor = (taxBucket: string) => {
    switch (taxBucket) {
      case 'tax_deferred':
        return {
          primary: '#f59e0b',
          secondary: '#d97706',
          shine: '#fbbf24'
        }
      case 'roth':
        return {
          primary: '#10b981',
          secondary: '#059669',
          shine: '#34d399'
        }
      case 'taxable':
        return {
          primary: '#3b82f6',
          secondary: '#2563eb',
          shine: '#60a5fa'
        }
      default:
        return {
          primary: '#6b7280',
          secondary: '#4b5563',
          shine: '#9ca3af'
        }
    }
  }

  const CoinStack = ({ account, numCoins, colors }: { 
    account: typeof chartData[0], 
    numCoins: number, 
    colors: ReturnType<typeof getCoinColor> 
  }) => {
    const coinHeight = 12 // Height of each coin in pixels
    const coinWidth = 80 // Width of coin
    const stackHeight = Math.min(numCoins * coinHeight, 400) // Max height

    return (
      <div className="flex flex-col items-center">
        {/* Coin stack */}
        <div 
          className="relative" 
          style={{ 
            width: `${coinWidth}px`, 
            height: `${stackHeight}px`,
            marginBottom: '12px'
          }}
        >
          {Array.from({ length: Math.min(numCoins, 30) }).map((_, i) => {
            const isHovered = hoveredCoin?.account === account.name && hoveredCoin?.coinIndex === i
            return (
              <div
                key={i}
                className="absolute left-0 transition-all duration-200 cursor-pointer"
                style={{
                  bottom: `${i * coinHeight}px`,
                  width: `${coinWidth}px`,
                  height: `${coinHeight + 4}px`,
                  zIndex: i,
                  transform: isHovered ? 'scale(1.05)' : 'scale(1)'
                }}
                onMouseEnter={() => setHoveredCoin({ account: account.name, coinIndex: i })}
                onMouseLeave={() => setHoveredCoin(null)}
              >
                <svg width={coinWidth} height={coinHeight + 4} viewBox="0 0 80 16">
                  {/* Coin shadow */}
                  <ellipse cx="40" cy="13" rx="38" ry="5" fill="rgba(0,0,0,0.3)" />
                  
                  {/* Main coin body */}
                  <ellipse cx="40" cy="8" rx="38" ry="7" fill={colors.primary} />
                  
                  {/* Coin shine/highlight */}
                  <ellipse cx="40" cy="6" rx="35" ry="4" fill={colors.shine} opacity="0.4" />
                  
                  {/* Coin edge */}
                  <ellipse cx="40" cy="8" rx="38" ry="7" fill="none" stroke={colors.secondary} strokeWidth="1" />
                  
                  {/* Inner circle */}
                  <ellipse cx="40" cy="8" rx="30" ry="5" fill="none" stroke={colors.shine} strokeWidth="0.5" opacity="0.6" />
                  
                  {/* Dollar sign */}
                  <text x="40" y="11" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="Arial">$</text>
                </svg>
                
                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute left-full ml-2 top-0 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-xs whitespace-nowrap z-50 shadow-lg">
                    <div className="text-white font-semibold">Coin #{i + 1}</div>
                    <div className="text-slate-400">${(coinValue / 1000).toFixed(0)}K</div>
                  </div>
                )}
              </div>
            )
          })}
          
          {/* Show +X more if too many coins */}
          {numCoins > 30 && (
            <div 
              className="absolute left-0 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              style={{ bottom: `${30 * coinHeight}px` }}
            >
              +{numCoins - 30} more
            </div>
          )}
        </div>

        {/* Account label */}
        <div className="text-center max-w-[100px]">
          <p className="font-sans text-white text-sm font-medium truncate" title={account.name}>
            {account.name}
          </p>
          <p className="font-sans text-slate-400 text-xs">
            ${(account.value / 1000).toFixed(0)}K
          </p>
          <p className="font-sans text-slate-500 text-xs">
            {numCoins} {numCoins === 1 ? 'coin' : 'coins'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h3 className="font-sans text-xl font-semibold text-white mb-2">
          Portfolio Balance
        </h3>
        <p className="font-sans text-slate-400 text-sm mb-4">
          Total: <span className="text-white font-semibold text-lg">${(totalPortfolio / 1000).toFixed(0)}K</span>
        </p>
        <div className="inline-block bg-slate-800 border border-slate-700 rounded px-3 py-1 text-xs text-slate-400">
          Each coin = ${(coinValue / 1000).toFixed(0)}K
        </div>
      </div>

      {/* Coin stacks */}
      <div className="flex justify-center items-end gap-8 flex-wrap min-h-[300px] py-4">
        {chartData.map((account, index) => (
          <CoinStack
            key={index}
            account={account}
            numCoins={account.numCoins}
            colors={getCoinColor(account.taxBucket)}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-8 pt-6 border-t border-slate-800">
        <div className="flex flex-wrap gap-6 justify-center text-xs">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 border border-amber-400" />
            <span className="font-sans text-slate-400">Tax-Deferred</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-green-600 border border-green-400" />
            <span className="font-sans text-slate-400">Roth</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 border border-blue-400" />
            <span className="font-sans text-slate-400">Taxable</span>
          </div>
        </div>
      </div>
    </div>
  )
}