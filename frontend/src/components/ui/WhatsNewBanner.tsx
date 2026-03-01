/**
 * WhatsNewBanner
 *
 * Dismissible banner on the Dashboard showing the latest release.
 * Disappears once the user visits /updates or dismisses it.
 * Re-appears on next deployment when version number changes.
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LATEST_RELEASE, LATEST_VERSION } from '@/data/releases'

const SEEN_KEY = 'mmp_seen_version'

export default function WhatsNewBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem(SEEN_KEY)
    setVisible(seen !== LATEST_VERSION)
  }, [])

  const dismiss = () => {
    localStorage.setItem(SEEN_KEY, LATEST_VERSION)
    setVisible(false)
  }

  if (!visible) return null

  const tagColors: Record<string, string> = {
    major:  'bg-violet-800/60 text-violet-300',
    new:    'bg-gold-800/40 text-gold-400',
    update: 'bg-slate-700 text-slate-300',
  }

  return (
    <div className="mb-6 flex items-center justify-between gap-4 bg-slate-900 border border-violet-700 rounded-xl px-5 py-3.5">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-violet-400 text-lg shrink-0">🎉</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {LATEST_RELEASE.tag && (
              <span className={`font-sans text-xs px-2 py-0.5 rounded-full shrink-0 ${tagColors[LATEST_RELEASE.tag] ?? ''}`}>
                v{LATEST_VERSION}
              </span>
            )}
            <p className="font-sans text-white text-sm font-semibold truncate">
              {LATEST_RELEASE.title}
            </p>
          </div>
          <p className="font-sans text-slate-400 text-xs mt-0.5 truncate">
            {LATEST_RELEASE.summary}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Link
          to="/updates"
          onClick={dismiss}
          className="font-sans text-violet-400 hover:text-violet-300 text-xs whitespace-nowrap transition-colors"
        >
          What's New →
        </Link>
        <button
          onClick={dismiss}
          className="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  )
}
