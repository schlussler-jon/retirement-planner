/**
 * AuthContext
 *
 * Provides authentication state globally.
 *   • isAuthenticated – true if user has valid session
 *   • user            – user profile data
 *   • login()         – redirects to Google OAuth
 *   • logout()        – navigates to API logout endpoint (handles cookie
 *                       deletion same-origin, then redirects to /login)
 */

import React, { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import client from '@/api/client'

interface User {
  email: string
  name: string
  picture: string
}

interface AuthContextValue {
  isAuthenticated: boolean
  isLoading: boolean
  user: User | null
  login: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// Auth status check
const fetchAuthStatus = async () => {
  const { data } = await client.get('/auth/status')
  return data
}

// Token exchange — uses native fetch so we control credentials explicitly
const exchangeToken = async (token: string) => {
  const apiBase = import.meta.env.PROD
    ? 'https://api.my-moneyplan.com'
    : 'http://localhost:8000'

  const response = await fetch(`${apiBase}/api/auth/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
    credentials: 'include',
  })

  if (!response.ok) throw new Error('Token exchange failed')
  return response.json()
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()

  // Detect token synchronously on first render so ProtectedRoute sees
  // isLoading=true from the very first paint — preventing a premature redirect.
  const [isExchanging, setIsExchanging] = useState(() =>
    new URLSearchParams(window.location.search).has('token')
  )

  // ── token exchange ────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (!token) return

    // Strip token from URL immediately (before async work)
    params.delete('token')
    const newUrl =
      window.location.pathname + (params.toString() ? '?' + params.toString() : '')
    window.history.replaceState({}, '', newUrl)

    exchangeToken(token)
      .then(async () => {
        // Wipe any stale cached auth state, then fetch a fresh status
        queryClient.removeQueries({ queryKey: ['authStatus'] })
        await queryClient.fetchQuery({
          queryKey: ['authStatus'],
          queryFn: fetchAuthStatus,
        })
      })
      .catch((err) => {
        console.error('Token exchange failed:', err)
      })
      .finally(() => {
        setIsExchanging(false)
      })
  }, [queryClient])

  // ── auth status query ─────────────────────────────────────────────────
  // Don't run while exchange is in flight — prevents a stale
  // `authenticated: false` from racing the exchange and redirecting to /login.
  const statusQuery = useQuery({
    queryKey: ['authStatus'],
    queryFn: fetchAuthStatus,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    enabled: !isExchanging,
  })

  const isAuthenticated = statusQuery.data?.authenticated ?? false
  const isLoading = isExchanging || statusQuery.isLoading
  const user: User | null = statusQuery.data?.user ?? null

  // ── login ─────────────────────────────────────────────────────────────
  const login = useCallback(() => {
    const apiBase = import.meta.env.PROD
      ? 'https://api.my-moneyplan.com'
      : 'http://localhost:8000'
    window.location.href = `${apiBase}/api/auth/login`
  }, [])

  // ── logout ────────────────────────────────────────────────────────────
  // Navigate directly to the API logout endpoint rather than making an
  // axios call. This ensures the cookie deletion is same-origin on
  // api.my-moneyplan.com, which is the only reliable way to clear a
  // SameSite=None cookie on Safari and iOS.
  const logout = useCallback(() => {
    queryClient.clear()
    const apiBase = import.meta.env.PROD
      ? 'https://api.my-moneyplan.com'
      : 'http://localhost:8000'
    window.location.href = `${apiBase}/api/auth/logout`
  }, [queryClient])

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
