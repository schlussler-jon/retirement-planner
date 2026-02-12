/**
 * LocalStorage utilities for saving/loading scenarios.
 */

import type { Scenario } from '@/types/scenario'

const STORAGE_KEY = 'retirement_planner_scenarios'

export interface StoredScenarios {
  scenarios: Scenario[]
  lastModified: string
}

/**
 * Load all scenarios from localStorage.
 */
export function loadScenariosFromStorage(): Scenario[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    
    const parsed: StoredScenarios = JSON.parse(data)
    return parsed.scenarios || []
  } catch (error) {
    console.error('Failed to load scenarios from localStorage:', error)
    return []
  }
}

/**
 * Save all scenarios to localStorage.
 */
export function saveScenariosToStorage(scenarios: Scenario[]): void {
  try {
    const data: StoredScenarios = {
      scenarios,
      lastModified: new Date().toISOString()
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    console.error('Failed to save scenarios to localStorage:', error)
  }
}

/**
 * Save a single scenario (update or add).
 */
export function saveScenarioToStorage(scenario: Scenario): void {
  const scenarios = loadScenariosFromStorage()
  const index = scenarios.findIndex(s => s.scenario_id === scenario.scenario_id)
  
  if (index >= 0) {
    scenarios[index] = scenario
  } else {
    scenarios.push(scenario)
  }
  
  saveScenariosToStorage(scenarios)
}

/**
 * Delete a scenario from localStorage.
 */
export function deleteScenarioFromStorage(scenarioId: string): void {
  const scenarios = loadScenariosFromStorage()
  const filtered = scenarios.filter(s => s.scenario_id !== scenarioId)
  saveScenariosToStorage(filtered)
}

/**
 * Export scenario as JSON file download.
 */
export function exportScenarioAsFile(scenario: Scenario): void {
  const json = JSON.stringify(scenario, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${scenario.scenario_name.replace(/[^a-z0-9]/gi, '_')}_${scenario.scenario_id}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Import scenario from JSON file.
 */
export function importScenarioFromFile(file: File): Promise<Scenario> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const scenario = JSON.parse(e.target?.result as string) as Scenario
        resolve(scenario)
      } catch (error) {
        reject(new Error('Invalid JSON file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
