/**
 * ProtectedRoute
 *
 * Wrap any <Route element={…}> with this component.
 * • While the auth status is loading → show a spinner.
 * • If not authenticated → redirect to /login.
 * • Otherwise → render children.
 */

import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gold-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400 text-sm font-sans">Checking session…</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
