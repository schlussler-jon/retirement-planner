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
              <svg width="28" height="28" viewBox="0 0 32 32" className="shrink-0">
                <rect width="32" height="32" rx="6" fill="#0f1623" stroke="#c9a84c" strokeWidth="1.5"/>
                <path d="M8 24 L16 8 L24 24" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="16" cy="20" r="2.5" fill="#c9a84c" opacity="0.6"/>
              </svg>
              <span className="font-display text-lg font-semibold text-gold-500 tracking-wide group-hover:text-gold-400 transition-colors">
                Retirement Planner
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
          Retirement Planner · All calculations are estimates · Not financial advice
        </p>
      </footer>
    </div>
  )
}
