/**
 * Layout
 *
 * Persistent chrome that wraps every authenticated page:
 *   • Top nav bar with logo, links, user avatar + logout
 *   • Main content area (children)
 *   • Subtle background texture
 */

import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

// ─── Nav links config ─────────────────────────────────────────────────────

const NAV_LINKS = [
  { to: '/',           label: 'Dashboard' },
  { to: '/scenarios', label: 'Scenarios' },
  { to: '/help',      label: 'Help' },
] as const

// ─── Component ────────────────────────────────────────────────────────────

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [offline, setOffline] = useState(!navigator.onLine)

  // close mobile menu on any navigation
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  // listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setOffline(false)
    const handleOffline = () => setOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* ── top nav ── */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

          {/* logo + nav links */}
          <nav className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 group">
              {/* Inline SVG icon — matches favicon */}
              <svg width="36" height="36" viewBox="0 0 512 512" className="shrink-0 rounded-xl">
              <defs>
                <linearGradient id="navBg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b0764"/>
                  <stop offset="100%" stopColor="#7c3aed"/>
                </linearGradient>
                <linearGradient id="navGold" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#fbbf24"/>
                  <stop offset="100%" stopColor="#d97706"/>
                </linearGradient>
              </defs>
              <rect width="512" height="512" rx="100" fill="url(#navBg)"/>
              <rect x="85"  y="305" width="60" height="68"  rx="8" fill="url(#navGold)" opacity="0.75"/>
              <rect x="175" y="242" width="60" height="131" rx="8" fill="url(#navGold)" opacity="0.85"/>
              <rect x="265" y="172" width="60" height="201" rx="8" fill="url(#navGold)" opacity="0.93"/>
              <rect x="355" y="108" width="60" height="265" rx="8" fill="url(#navGold)"/>
              <polyline points="115,298 205,236 295,162 385,100"
                fill="none" stroke="#fbbf24" strokeWidth="10"
                strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="385" cy="100" r="16" fill="#fde68a"/>
              <circle cx="385" cy="100" r="7"  fill="#ffffff"/>
              <line x1="68" y1="376" x2="444" y2="376" stroke="#a78bfa" strokeWidth="3" opacity="0.7"/>
              </svg>
              <span className="font-display text-lg font-semibold tracking-wide group-hover:opacity-80 transition-opacity">
              <span style={{color: '#c4b5fd', fontWeight: 300}}>my-</span>
              <span style={{color: '#f59e0b', fontWeight: 800}}>money</span>
              <span style={{color: '#a855f7', fontWeight: 800}}>plan</span>
              <span style={{color: '#fbbf24', fontSize: '0.75em', fontWeight: 600}}>.com</span>
              </span>
            </Link>

            <div className="hidden sm:flex items-center gap-1">
              {NAV_LINKS.map(({ to, label }) => {
                const active = location.pathname === to ||
                  (to !== '/' && location.pathname.startsWith(to))
                return (
                  <Link
                    key={to}
                    to={to}
                    className={[
                      'px-3 py-1.5 rounded-md text-sm font-sans font-medium transition-colors',
                      active
                        ? 'text-white bg-slate-800'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60',
                    ].join(' ')}
                  >
                    {label}
                  </Link>
                )
              })}
            </div>
          </nav>

          {/* user section */}
          <div className="flex items-center gap-3">
            {/* hamburger – mobile only */}
            <button
              onClick={() => setMenuOpen(prev => !prev)}
              className="sm:hidden flex items-center justify-center w-9 h-9 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Toggle menu"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {menuOpen ? (
                  <>
                    <line x1="4" y1="4" x2="16" y2="16" />
                    <line x1="16" y1="4" x2="4" y2="16" />
                  </>
                ) : (
                  <>
                    <line x1="3" y1="6"  x2="17" y2="6"  />
                    <line x1="3" y1="10" x2="17" y2="10" />
                    <line x1="3" y1="14" x2="17" y2="14" />
                  </>
                )}
              </svg>
            </button>

            {user && (
              <>
                <span className="hidden sm:block text-slate-400 text-sm font-sans">
                  {user.email}
                </span>

                {/* avatar */}
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover border border-slate-700"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                    <span className="text-slate-300 text-xs font-sans font-semibold">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </>
            )}

            <button
              onClick={logout}
              className="hidden sm:block px-3 py-1.5 rounded-md text-sm font-sans text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* ── mobile menu ── */}
        {menuOpen && (
          <div className="sm:hidden border-t border-slate-800 bg-slate-900/95 backdrop-blur-sm">
            <div className="px-4 py-3 space-y-1">
              {NAV_LINKS.map(({ to, label }) => {
                const active = location.pathname === to ||
                  (to !== '/' && location.pathname.startsWith(to))
                return (
                  <Link
                    key={to}
                    to={to}
                    className={[
                      'block px-3 py-2.5 rounded-lg text-sm font-sans font-medium transition-colors',
                      active
                        ? 'text-white bg-slate-800'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60',
                    ].join(' ')}
                  >
                    {label}
                  </Link>
                )
              })}
            </div>
            {user && (
              <div className="px-4 pb-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-slate-500 text-xs font-sans">{user.email}</span>
                <button
                  onClick={logout}
                  className="px-3 py-1.5 rounded-md text-sm font-sans text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── offline banner ── */}
      {offline && (
        <div className="bg-amber-900/20 border-b border-amber-700/30 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 text-sm">⚠</span>
              <p className="font-sans text-amber-400 text-sm">You're offline. Some features may not work.</p>
            </div>
            <button
              onClick={() => setOffline(false)}
              className="font-sans text-amber-400/70 hover:text-amber-400 text-xs transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── main content ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {children}
      </main>

      {/* ── footer ── */}
      <footer className="border-t border-slate-800 px-4 py-4 text-center">
        <p className="text-slate-600 text-xs font-sans">
          my-moneyplan.com · All calculations are estimates · Not financial advice
        </p>
      </footer>
    </div>
  )
}
