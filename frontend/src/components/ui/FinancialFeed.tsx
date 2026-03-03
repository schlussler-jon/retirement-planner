/**
 * FinancialFeed
 *
 * Personalized financial insight cards — refreshed on login via OpenAI web search.
 * Shows 6 cards across Income, Investment, Tax, Retirement, Economic, Medicare categories.
 * Cached 24 hours server-side; user can manually refresh.
 */

import { useState, useEffect } from 'react'
import client from '@/api/client'

// ─── Types ────────────────────────────────────────────────────────────────

interface InsightCard {
  category:    string
  icon:        string
  color:       string
  headline:    string
  insight:     string
  action?:     string
  source_hint?: string
}

interface FeedResponse {
  cards:      InsightCard[]
  cached:     boolean
  updated_at: number
  user_context_summary: string
}

// ─── Color map ────────────────────────────────────────────────────────────

const COLOR_STYLES: Record<string, { border: string; badge: string; action: string }> = {
  violet: {
    border: 'border-violet-700/50 hover:border-violet-600',
    badge:  'bg-violet-900/60 text-violet-300',
    action: 'text-violet-400',
  },
  green: {
    border: 'border-green-800/40 hover:border-green-700',
    badge:  'bg-green-900/50 text-green-300',
    action: 'text-green-400',
  },
  gold: {
    border: 'border-yellow-800/40 hover:border-yellow-700',
    badge:  'bg-yellow-900/40 text-yellow-300',
    action: 'text-yellow-400',
  },
  blue: {
    border: 'border-blue-800/40 hover:border-blue-700',
    badge:  'bg-blue-900/50 text-blue-300',
    action: 'text-blue-400',
  },
  slate: {
    border: 'border-slate-700/50 hover:border-slate-600',
    badge:  'bg-slate-700/60 text-slate-300',
    action: 'text-slate-400',
  },
  teal: {
    border: 'border-teal-800/40 hover:border-teal-700',
    badge:  'bg-teal-900/50 text-teal-300',
    action: 'text-teal-400',
  },
}

// ─── Single Card ──────────────────────────────────────────────────────────

function InsightCardView({ card }: { card: InsightCard }) {
  const [expanded, setExpanded] = useState(true)
  const styles = COLOR_STYLES[card.color] ?? COLOR_STYLES.slate

  return (
    <div
      className={`bg-slate-900 border rounded-xl p-4 transition-all duration-200 cursor-pointer ${styles.border}`}
      onClick={() => setExpanded(v => !v)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg shrink-0">{card.icon}</span>
          <span className={`font-sans text-xs px-2 py-0.5 rounded-full font-medium ${styles.badge}`}>
            {card.category}
          </span>
        </div>
        <span className="text-slate-600 text-xs mt-0.5 shrink-0">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Headline */}
      <p className="font-sans text-white text-sm font-semibold leading-snug mb-2">
        {card.headline}
      </p>

      {/* Insight — always show first sentence, expand for rest */}
      <p className={`font-sans text-slate-300 text-xs leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
        {card.insight}
      </p>

      {/* Action + source — only when expanded */}
      {expanded && (
        <>
          {card.action && (
            <div className="mt-3 pt-3 border-t border-slate-800">
              <p className="font-sans text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Action
              </p>
              <p className={`font-sans text-xs font-medium leading-relaxed ${styles.action}`}>
                → {card.action}
              </p>
            </div>
          )}
          {card.source_hint && (
            <p className="font-sans text-slate-600 text-xs mt-2">{card.source_hint}</p>
          )}
        </>
      )}
    </div>
  )
}

// ─── Skeleton loader ──────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-slate-900 border border-violet-900/30 rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 bg-slate-800 rounded-full" />
        <div className="h-4 w-28 bg-slate-800 rounded-full" />
      </div>
      <div className="h-4 w-full bg-slate-800 rounded mb-1.5" />
      <div className="h-4 w-4/5 bg-slate-800 rounded mb-3" />
      <div className="h-3 w-full bg-slate-800/60 rounded mb-1" />
      <div className="h-3 w-3/4 bg-slate-800/60 rounded" />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────

export default function FinancialFeed() {
  const [data,      setData]      = useState<FeedResponse | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await client.get<FeedResponse>(
        `/financial-feed${refresh ? '?refresh=true' : ''}`
      )
      setData(res.data)
    } catch (e: any) {
      setError('Could not load financial insights')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => load(), 1000)
    return () => clearTimeout(t)
  }, [])

  const updatedAt = data ? new Date(data.updated_at * 1000) : null
  const timeStr   = updatedAt?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const dateStr   = updatedAt?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className="mt-10">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-sans text-white text-sm font-semibold">
            Financial Intelligence
          </h2>
          <p className="font-sans text-slate-500 text-xs mt-0.5">
            Personalized insights — click any card to expand
            {data && (
              <span className="ml-2">
                · {data.cached ? 'Cached' : 'Updated'} {dateStr} at {timeStr}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing || loading}
          className="font-sans text-slate-400 hover:text-gold-400 text-xs border border-violet-900 hover:border-gold-600 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
        >
          {refreshing ? '↻ Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-4 text-center">
          <p className="font-sans text-red-400 text-sm">{error}</p>
          <button onClick={() => load()} className="font-sans text-red-400 hover:text-red-300 text-xs mt-2 underline">
            Try again
          </button>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Cards */}
      {data && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.cards.map((card, i) => (
            <InsightCardView key={i} card={card} />
          ))}
        </div>
      )}

      {/* Disclaimer */}
      {data && !loading && (
        <p className="font-sans text-slate-600 text-xs text-center mt-4">
          For educational purposes only — consult a licensed financial advisor before making investment decisions.
        </p>
      )}
    </div>
  )
}
