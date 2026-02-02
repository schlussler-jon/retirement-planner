/**
 * ErrorBoundary
 *
 * React error boundaries for graceful degradation:
 *   • Root-level:  Catches app-wide crashes, shows full-screen fallback with reload
 *   • Page-level:  Catches isolated component errors, shows inline fallback
 */

import React, { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  level?: 'root' | 'page'
  pageName?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    // Custom fallback if provided
    if (this.props.fallback) {
      return this.props.fallback
    }

    const { level = 'page', pageName } = this.props

    // Root-level fallback — full screen
    if (level === 'root') {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
          <div className="text-center max-w-md animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-danger text-2xl">⚠</span>
            </div>
            <h1 className="font-display text-2xl text-white mb-2">Something went wrong</h1>
            <p className="font-sans text-slate-500 text-sm mb-6">
              The app encountered an unexpected error. Try reloading the page.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="
                  bg-gold-600 hover:bg-gold-500
                  text-slate-950 font-sans font-semibold text-sm
                  px-5 py-2.5 rounded-lg
                  transition-colors duration-150
                "
              >
                Reload Page
              </button>
              <a
                href="/"
                className="
                  font-sans text-slate-500 hover:text-gold-400 text-sm
                  px-4 py-2.5 rounded-lg border border-slate-700 hover:border-gold-600
                  transition-colors duration-150
                "
              >
                Go Home
              </a>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="font-sans text-slate-600 text-xs cursor-pointer hover:text-slate-500">
                  Error details (dev only)
                </summary>
                <pre className="mt-2 p-3 bg-slate-900 border border-slate-800 rounded text-danger text-xs overflow-auto max-h-32">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    // Page-level fallback — inline card
    return (
      <div className="bg-danger/10 border border-danger/30 rounded-xl px-5 py-8 text-center">
        <div className="w-12 h-12 rounded-full bg-danger/20 flex items-center justify-center mx-auto mb-3">
          <span className="text-danger text-lg">⚠</span>
        </div>
        <p className="font-sans text-danger text-sm font-semibold mb-1">
          {pageName ? `${pageName} Error` : 'Component Error'}
        </p>
        <p className="font-sans text-slate-500 text-xs mb-4">
          This section encountered a problem. Try refreshing the page.
        </p>
        <button
          onClick={this.handleReset}
          className="font-sans text-danger hover:text-danger/70 text-xs transition-colors"
        >
          Try Again →
        </button>
        {process.env.NODE_ENV === 'development' && this.state.error && (
          <details className="mt-4">
            <summary className="font-sans text-slate-600 text-xs cursor-pointer hover:text-slate-500">
              Error details (dev only)
            </summary>
            <pre className="mt-2 p-3 bg-slate-900 border border-slate-800 rounded text-danger text-xs overflow-auto max-h-24 text-left">
              {this.state.error.toString()}
            </pre>
          </details>
        )}
      </div>
    )
  }
}
