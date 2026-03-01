/**
 * WhatsNew
 *
 * Full release notes page at /updates.
 * Marks the latest release as seen in localStorage.
 */

import { useEffect } from 'react'
import { RELEASES, LATEST_VERSION } from '@/data/releases'

const SEEN_KEY = 'mmp_seen_version'

function tagBadge(tag?: string) {
  if (!tag) return null
  const styles: Record<string, string> = {
    major:  'bg-violet-900/60 text-violet-300 border border-violet-700',
    new:    'bg-gold-900/40 text-gold-400 border border-gold-700/50',
    update: 'bg-slate-700/60 text-slate-300 border border-slate-600',
  }
  const labels: Record<string, string> = {
    major: 'Major Release',
    new:   'New Feature',
    update: 'Update',
  }
  return (
    <span className={`font-sans text-xs px-2 py-0.5 rounded-full ${styles[tag] ?? ''}`}>
      {labels[tag] ?? tag}
    </span>
  )
}

export default function WhatsNew() {
  // Mark latest as seen when visiting this page
  useEffect(() => {
    localStorage.setItem(SEEN_KEY, LATEST_VERSION)
  }, [])

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl text-white mb-2">What's New</h1>
        <p className="font-sans text-slate-400 text-sm">
          Release notes and updates for my-moneyplan.com
        </p>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-3 top-0 bottom-0 w-px bg-violet-900/60" />

        <div className="space-y-8">
          {RELEASES.map((release, i) => (
            <div key={release.version} className="relative pl-10">
              {/* Dot */}
              <div className={`absolute left-0 top-1.5 w-7 h-7 rounded-full border-2 flex items-center justify-center
                ${i === 0
                  ? 'bg-violet-700 border-violet-500'
                  : 'bg-slate-800 border-violet-900'}`}>
                <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-white' : 'bg-violet-700'}`} />
              </div>

              {/* Card */}
              <div className={`bg-slate-900 border rounded-xl p-5
                ${i === 0 ? 'border-violet-700' : 'border-violet-900'}`}>

                {/* Header row */}
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-sans text-white font-semibold text-base">{release.title}</span>
                  {tagBadge(release.tag)}
                  {i === 0 && (
                    <span className="font-sans text-xs bg-green-900/40 text-green-400 border border-green-800/50 px-2 py-0.5 rounded-full">
                      Latest
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <span className="font-sans text-slate-500 text-xs">v{release.version}</span>
                  <span className="text-slate-700">·</span>
                  <span className="font-sans text-slate-500 text-xs">
                    {new Date(release.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>

                {/* Features */}
                <ul className="space-y-1.5 mb-3">
                  {release.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <span className="text-violet-400 mt-0.5 shrink-0">✦</span>
                      <span className="font-sans text-slate-300 text-sm">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* Fixes */}
                {release.fixes && release.fixes.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-violet-900/50">
                    <p className="font-sans text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Bug Fixes</p>
                    <ul className="space-y-1">
                      {release.fixes.map((f, j) => (
                        <li key={j} className="flex items-start gap-2">
                          <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                          <span className="font-sans text-slate-400 text-sm">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="font-sans text-slate-600 text-xs text-center mt-10 pb-4">
        my-moneyplan.com · Built with ❤️ for your financial future
      </p>
    </div>
  )
}
