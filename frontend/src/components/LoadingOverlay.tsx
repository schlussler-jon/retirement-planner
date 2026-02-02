/**
 * LoadingOverlay
 *
 * Full-screen centered spinner with message for long-running operations.
 * Use for Drive saves/loads or any async task that blocks the UI.
 */

interface Props {
  message?: string
}

export default function LoadingOverlay({ message = 'Loading…' }: Props) {
  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-8 py-6 flex flex-col items-center gap-4 animate-fade-in">
        {/* Spinner */}
        <div className="w-10 h-10 border-3 border-slate-700 border-t-gold-500 rounded-full animate-spin"></div>
        <p className="font-sans text-slate-300 text-sm">{message}</p>
      </div>
    </div>
  )
}
