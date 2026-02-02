/**
 * React Query client.
 *
 * Defaults are tuned for a financial app where stale data is cheap
 * but failed requests must retry reliably.
 */

import { QueryClient } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,           // data is "fresh" for 30 s
      gcTime: 5 * 60_000,          // unused cache lives 5 min
      retry: 2,                    // retry failed fetches twice
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    },
    mutations: {
      retry: 1,
    },
  },
})

export default queryClient
