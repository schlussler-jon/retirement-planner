/**
 * React Query hooks.
 *
 * Each hook wraps one backend endpoint (or a small group of related ones).
 * Naming convention: useXxx  (query) / useXxxMutation  (mutation).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client from './client'

import type { Scenario }                  from '@/types/scenario'
import type {
  AuthStatus,
  AuthUser,
  ScenarioCreateResponse,
  ScenarioListResponse,
  ValidationResponse,
  ProjectionResponse,
  QuickProjectionResponse,
  DriveSaveResponse,
  DriveListResponse,
  DriveDeleteResponse,
} from '@/types/api'

// ─── Query-key factory ────────────────────────────────────────────────────
// Centralised so invalidation is easy and typo-proof.

export const qk = {
  authStatus:        () => ['auth', 'status']        as const,
  authMe:            () => ['auth', 'me']            as const,
  scenarios:         () => ['scenarios']             as const,
  scenario:          (id: string) => ['scenarios', id] as const,
  projection:        (id: string) => ['projections', id] as const,
  quickProjection:   (id: string) => ['projections', id, 'quick'] as const,
  driveScenarios:    () => ['drive', 'scenarios']    as const,
}

// ─── Auth ─────────────────────────────────────────────────────────────────

/** Polls auth status — lightweight, used to gate the UI. */
export function useAuthStatus() {
  return useQuery({
    queryKey: qk.authStatus(),
    queryFn: async () => {
      const { data } = await client.get<AuthStatus>('/auth/status')
      return data
    },
    staleTime: 60_000, // re-fetch every minute at most
  })
}

/** Full user profile — only fetched when we know we're authenticated. */
export function useCurrentUser(enabled = true) {
  return useQuery({
    queryKey: qk.authMe(),
    queryFn: async () => {
      const { data } = await client.get<AuthUser>('/auth/me')
      return data
    },
    enabled,
  })
}

/** Logout mutation — clears server session then invalidates local cache. */
export function useLogoutMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await client.post('/auth/logout')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.authStatus() })
      qc.invalidateQueries({ queryKey: qk.authMe() })
    },
  })
}

// ─── Scenarios (in-memory CRUD on the backend) ───────────────────────────

/** List all scenarios currently in the backend's memory. */
export function useScenarios() {
  return useQuery({
    queryKey: qk.scenarios(),
    queryFn: async () => {
      const { data } = await client.get<ScenarioListResponse>('/scenarios')
      return data
    },
  })
}

/** Fetch a single scenario by id. */
export function useScenario(id: string, enabled = true) {
  return useQuery({
    queryKey: qk.scenario(id),
    queryFn: async () => {
      const { data } = await client.get<Scenario>(`/scenarios/${id}`)
      return data
    },
    enabled: enabled && id.length > 0,
  })
}

/** POST /api/scenarios — create a new scenario. */
export function useCreateScenario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (scenario: Scenario) => {
      const { data } = await client.post<ScenarioCreateResponse>('/scenarios', scenario)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.scenarios() })
    },
  })
}

/** PUT /api/scenarios/:id — update an existing scenario. */
export function useUpdateScenario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (scenario: Scenario) => {
      const { data } = await client.put<ScenarioCreateResponse>(
        `/scenarios/${scenario.scenario_id}`,
        scenario
      )
      return data
    },
    onSuccess: (_data, scenario) => {
      qc.invalidateQueries({ queryKey: qk.scenarios() })
      qc.invalidateQueries({ queryKey: qk.scenario(scenario.scenario_id) })
    },
  })
}

/** DELETE /api/scenarios/:id */
export function useDeleteScenario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await client.delete(`/scenarios/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.scenarios() })
    },
  })
}

/** POST /api/scenarios/validate — dry-run validation. */
export function useValidateScenario() {
  return useMutation({
    mutationFn: async (scenario: Scenario) => {
      const { data } = await client.post<ValidationResponse>('/scenarios/validate', scenario)
      return data
    },
  })
}

// ─── Projections ──────────────────────────────────────────────────────────

/** Full projection — includes monthly, annual, tax, and net-income tables. */
export function useProjection(scenarioId: string, enabled = false) {
  return useQuery({
    queryKey: qk.projection(scenarioId),
    queryFn: async () => {
      const { data } = await client.post<ProjectionResponse>(
        `/scenarios/${scenarioId}/projection`,
        {
          include_monthly: true,
          include_annual: true,
          include_tax_summary: true,
          include_net_income: true,
        }
      )
      return data
    },
    enabled: enabled && scenarioId.length > 0,
  })
}

/** Quick projection — summary numbers only, very fast. */
export function useQuickProjection(scenarioId: string, enabled = false) {
  return useQuery({
    queryKey: qk.quickProjection(scenarioId),
    queryFn: async () => {
      const { data } = await client.post<QuickProjectionResponse>(
        `/scenarios/${scenarioId}/projection/quick`
      )
      return data
    },
    enabled: enabled && scenarioId.length > 0,
  })
}

/** Imperative trigger — use when a button click should kick off a projection. */
export function useRunProjectionMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (scenarioId: string) => {
      const { data } = await client.post<ProjectionResponse>(
        `/scenarios/${scenarioId}/projection`,
        {
          include_monthly: true,
          include_annual: true,
          include_tax_summary: true,
          include_net_income: true,
        }
      )
      return data
    },
    onSuccess: (_data, scenarioId) => {
      qc.setQueryData(qk.projection(scenarioId), _data)
    },
  })
}

// ─── Google Drive ─────────────────────────────────────────────────────────

/** List all scenarios saved to the user's Drive. */
export function useDriveScenarios(enabled = true) {
  return useQuery({
    queryKey: qk.driveScenarios(),
    queryFn: async () => {
      const { data } = await client.get<DriveListResponse>('/drive/scenarios/list')
      return data
    },
    enabled,
  })
}

/** Save a scenario to Drive. */
export function useSaveToDrive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (scenario: Scenario) => {
      const { data } = await client.post<DriveSaveResponse>(
        `/drive/scenarios/${scenario.scenario_id}/save`,
        scenario
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.driveScenarios() })
    },
  })
}

/** Load a scenario from Drive. */
export function useLoadFromDrive() {
  return useMutation({
    mutationFn: async (scenarioId: string) => {
      const { data } = await client.get<Scenario>(
        `/drive/scenarios/${scenarioId}/load`
      )
      return data
    },
  })
}

/** Delete a scenario from Drive. */
export function useDeleteFromDrive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (scenarioId: string) => {
      const { data } = await client.delete<DriveDeleteResponse>(
        `/drive/scenarios/${scenarioId}/drive`
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.driveScenarios() })
    },
  })
}
