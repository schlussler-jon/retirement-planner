/**
 * Login
 *
 * Full-page unauthenticated landing.  Centred card on a dark gradient
 * with a subtle geometric accent.  Single CTA: "Sign in with Google".
 */

import { useAuth } from '@/contexts/AuthContext'
import { Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

export default function Login() {
  const { isAuthenticated, isLoading, login } = useAuth()
  const [showExpired, setShowExpired] = useState(false)

  useEffect(() => {
    const expired = sessionStorage.getItem('sessionExpired')
    if (expired) {
      setShowExpired(true)
      sessionStorage.removeItem('sessionExpired')
      setTimeout(() => setShowExpired(false), 5000)
    }
  }, [])

  // Already logged in? Skip straight to dashboard.
  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-slate-950">

      {/* ── decorative geometry ── */}
      {/* Large ring — top-left */}
      <div
        className="absolute rounded-full border border-slate-800 pointer-events-none"
        style={{ width: 600, height: 600, top: -200, left: -200, opacity: 0.4 }}
      />
      {/* Medium ring — bottom-right */}
      <div
        className="absolute rounded-full border border-slate-800 pointer-events-none"
        style={{ width: 400, height: 400, bottom: -150, right: -150, opacity: 0.3 }}
      />
      {/* Gold accent dot — top-right */}
      <div
        className="absolute rounded-full bg-gold-600 pointer-events-none"
        style={{ width: 12, height: 12, top: '18%', right: '22%', opacity: 0.7 }}
      />
      {/* Gold accent dot — bottom-left */}
      <div
        className="absolute rounded-full bg-gold-600 pointer-events-none"
        style={{ width: 8, height: 8, bottom: '25%', left: '18%', opacity: 0.5 }}
      />
      {/* Subtle gradient wash */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 30% 20%, rgba(201,168,76,0.04) 0%, transparent 70%), ' +
            'radial-gradient(ellipse 60% 40% at 75% 80%, rgba(201,168,76,0.03) 0%, transparent 70%)',
        }}
      />

      {/* ── card ── */}
      <div className="relative z-10 w-full max-w-md mx-auto px-6 animate-slide-up">
        {/* logo */}
        <div className="flex flex-col items-center gap-4 mb-10">
          <svg width="56" height="56" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="6" fill="#141c2e" stroke="#c9a84c" strokeWidth="1.2"/>
            <path d="M8 24 L16 8 L24 24" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="16" cy="20" r="2.5" fill="#c9a84c" opacity="0.6"/>
          </svg>

          <h1 className="font-display text-4xl font-semibold text-white tracking-tight leading-none">
            Retirement Planner
          </h1>
          <p className="font-sans text-slate-500 text-sm text-center leading-relaxed max-w-xs">
            Model your income, taxes, and spending across decades of retirement — with IRS-accurate calculations.
          </p>
        </div>

        {/* sign-in card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 flex flex-col items-center gap-6">
          {showExpired && (
            <div className="w-full bg-amber-900/20 border border-amber-700/30 rounded-lg px-4 py-3 mb-2">
              <p className="font-sans text-amber-400 text-sm text-center">
                Your session expired. Please sign in again.
              </p>
            </div>
          )}
          <p className="font-sans text-slate-400 text-sm text-center">
            Sign in to save and manage your retirement scenarios.
          </p>

          <button
            onClick={login}
            className="
              w-full flex items-center justify-center gap-3
              bg-white text-slate-800
              hover:bg-slate-100
              active:bg-slate-200
              font-sans font-semibold text-sm
              px-5 py-3 rounded-lg
              shadow-sm
              transition-colors duration-150
            "
          >
            {/* Google SVG icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" className="shrink-0">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>

          <p className="font-sans text-slate-600 text-xs text-center leading-relaxed">
            We only access files created by this app in your Google Drive.
            <br/>No ads, no data sharing.
          </p>
        </div>

        {/* bottom note */}
        <p className="font-sans text-slate-600 text-xs text-center mt-8">
          All calculations run on your own server · Your data stays in your Drive
        </p>
      </div>
    </div>
  )
}
