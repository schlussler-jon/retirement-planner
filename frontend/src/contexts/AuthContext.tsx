/**
 * AuthContext
 *
 * Wraps the entire app.  Any component can call useAuth() to get:
 *   • isAuthenticated   – boolean
 *   • user              – { email, name, picture } | null
 *   • isLoading         – true while the first status check is in-flight
 *   • login()           – redirects to Google OAuth
 *   • logout()          – clears session
 */

import React, { createContext, useContext, useCallback } from 'react'
import { useAuthStatus, useCurrentUser, useLogoutMutation } from '@/api/hooks'
import type { AuthUser } from '@/types/api'

// ─── Shape ────────────────────────────────────────────────────────────────

interface AuthContextValue {
  isAuthenticated: boolean
  isLoading: boolean
  user: AuthUser | null | undefined
  login: () => void
  logout: () => Promise<void>
}

// ─── Context ──────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// ─── Provider ─────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const statusQuery  = useAuthStatus()
  const userQuery    = useCurrentUser(statusQuery.data?.authenticated ?? false)
  const logoutMut    = useLogoutMutation()

  const isAuthenticated = statusQuery.data?.authenticated ?? false
  const isLoading       = statusQuery.isLoading

  /** Kick off the OAuth dance — browser navigates away. */
  const login = useCallback(() => {
    // The backend's /api/auth/login returns a redirect to Google.
    // We open it in the current tab so the cookie lands on our origin.
    window.location.href = 'https://retirement-planner-production.up.railway.app/api/auth/login'
  }, [])

  /** POST /api/auth/logout then wait for React Query to invalidate. */
  const logout = useCallback(async () => {
    await logoutMut.mutateAsync()
  }, [logoutMut])

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user: userQuery.data, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth() must be called inside <AuthProvider>')
  }
  return ctx
}
