'use client'

const BADGE_STYLES = {
  high: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  low: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
} as const

const LABELS = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
} as const

export function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[confidence]}`}>
      {LABELS[confidence]}
    </span>
  )
}
