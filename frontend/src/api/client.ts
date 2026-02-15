/**
 * Axios HTTP client.
 *
 * All requests go through Vite's dev-server proxy at /api →
 * http://localhost:8000.  Session cookies are sent automatically
 * because withCredentials is enabled.
 */

import axios from 'axios'

const client = axios.create({
  baseURL: window.location.hostname === 'localhost' 
  ? 'http://localhost:8000/api'
  : 'https://retirement-planner-production.up.railway.app/api',
  timeout: 30_000,            // 30 s — projections can take a moment
  withCredentials: true,      // send HttpOnly session cookie on every request
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Response interceptor: handle session expiry + normalise errors ──────

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      // Session expired - redirect to login unless already there
      if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
        // Clear any stale session state
        sessionStorage.setItem('sessionExpired', 'true')
        window.location.href = '/login'
        return Promise.reject(new Error('Session expired'))
      }
      
      // Normalize error message for other errors
      if (error.response?.data?.detail) {
        error.message = error.response.data.detail as string
      }
    }
    return Promise.reject(error)
  }
)

export default client
