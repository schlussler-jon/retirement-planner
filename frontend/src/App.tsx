/**
 * App – route tree
 *
 *   /login                   → Login              (public)
 *   /                        → Home               (protected)
 *   /scenarios               → Scenarios list     (protected)
 *   /scenarios/new           → ScenarioEditor     (protected, create)
 *   /scenarios/:id           → ScenarioEditor     (protected, edit)
 *   /scenarios/:id/results   → ProjectionResults  (protected)
 */

import { Routes, Route, BrowserRouter } from 'react-router-dom'
import { AuthProvider }                 from '@/contexts/AuthContext'
import ProtectedRoute                   from '@/components/ProtectedRoute'
import Layout                           from '@/components/Layout'
import Login                            from '@/pages/Login'
import Home                             from '@/pages/Home'
import Scenarios                        from '@/pages/Scenarios'
import ScenarioEditor                   from '@/pages/ScenarioEditor'
import ProjectionResults                from '@/pages/ProjectionResults'
import ExecutiveSummary                from '@/pages/ExecutiveSummary'
import Compare                          from '@/pages/Compare'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── public ── */}
          <Route path="/login" element={<Login />} />

          {/* ── protected ── */}
          <Route path="/"
            element={<ProtectedRoute><Layout><Home /></Layout></ProtectedRoute>} />

          <Route path="/scenarios"
            element={<ProtectedRoute><Layout><Scenarios /></Layout></ProtectedRoute>} />

          <Route path="/scenarios/new"
            element={<ProtectedRoute><Layout><ScenarioEditor /></Layout></ProtectedRoute>} />

          <Route path="/scenarios/compare"
            element={<ProtectedRoute><Layout><Compare /></Layout></ProtectedRoute>} />

          <Route path="/scenarios/:id"
            element={<ProtectedRoute><Layout><ScenarioEditor /></Layout></ProtectedRoute>} />

          <Route path="/scenarios/:id/results"
            element={<ProtectedRoute><Layout><ProjectionResults /></Layout></ProtectedRoute>} />
          <Route path="/scenarios/:id/summary" 
            element={<ProtectedRoute><Layout><ExecutiveSummary /></Layout></ProtectedRoute>} />

          {/* ── 404 ── */}
          <Route path="*"
            element={
              <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center animate-fade-in">
                  <p className="font-display text-6xl text-slate-800 font-semibold">404</p>
                  <p className="font-sans text-slate-500 text-sm mt-2">Page not found</p>
                  <a href="/" className="font-sans text-gold-500 hover:text-gold-400 text-sm mt-4 inline-block transition-colors">
                    ← Back to dashboard
                  </a>
                </div>
              </div>
            } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
