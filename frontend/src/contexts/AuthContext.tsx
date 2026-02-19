/**
 * AuthContext
 *
 * Provides authentication state globally.
 *   • isAuthenticated – true if user has valid session
 *   • user            – user profile data
 *   • login()         – redirects to Google OAuth
 *   • logout()        – POST /api/auth/logout
 */

import React, { createContext, useContext, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import axios from 'axios'

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
  const { data } = await axios.get('/api/auth/status', { withCredentials: true })
  return data
}

// Token exchange
const exchangeToken = async (token: string) => {
  const apiBase = import.meta.env.PROD 
    ? 'https://api.my-moneyplan.com'
    : 'http://localhost:8000'
  
  const { data } = await axios.post(
    `${apiBase}/api/auth/exchange`, 
    { token },
    { withCredentials: true }
  )
  return data
}

// Current user query
const useCurrentUser = (enabled: boolean) => {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchAuthStatus,
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  
  // Check for token in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    
    if (token) {
      // Exchange token for session cookie
      exchangeToken(token)
        .then(async () => {
          // Remove token from URL
          params.delete('token')
          const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '')
          window.history.replaceState({}, '', newUrl)
    
          // Refresh auth status and WAIT for it
          await queryClient.invalidateQueries({ queryKey: ['authStatus'] })
          await queryClient.invalidateQueries({ queryKey: ['currentUser'] })
          await queryClient.refetchQueries({ queryKey: ['authStatus'] })
        })
        .catch((err) => {
          console.error('Token exchange failed:', err)
          // Remove token from URL even on failure
          params.delete('token')
          const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '')
          window.history.replaceState({}, '', newUrl)
        })
    }
  }, [queryClient])
  
  const statusQuery = useQuery({
    queryKey: ['authStatus'],
    queryFn: fetchAuthStatus,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  })

  const userQuery = useCurrentUser(statusQuery.data?.authenticated ?? false)

  const isAuthenticated = statusQuery.data?.authenticated ?? false
  const isLoading = statusQuery.isLoading

  const login = useCallback(() => {
    const apiBase = import.meta.env.PROD 
      ? 'https://api.my-moneyplan.com'
      : 'http://localhost:8000'
    window.location.href = `${apiBase}/api/auth/login`
  }, [])

  /** POST /api/auth/logout then wait for React Query to invalidate. */
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await axios.post('/api/auth/logout', {}, { withCredentials: true })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['authStatus'] })
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
    },
  })

  const logout = useCallback(() => {
    logoutMutation.mutate()
  }, [logoutMutation])

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user: userQuery.data, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}