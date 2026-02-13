/**
 * Simple tooltip component for explaining metrics
 */

import { ReactNode, useState } from 'react'

interface TooltipProps {
  content: string | ReactNode
  children: ReactNode
}

export default function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children}
      </div>
      
      {isVisible && (
        <div className="absolute z-50 w-64 px-3 py-2 text-sm text-white bg-slate-900 border border-slate-700 rounded-lg shadow-xl bottom-full left-1/2 -translate-x-1/2 mb-2">
          <div className="font-sans leading-relaxed">
            {content}
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="border-8 border-transparent border-t-slate-700"></div>
          </div>
        </div>
      )}
    </div>
  )
}
