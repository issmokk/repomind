'use client'

import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

function mapError(message: string): { title: string; suggestion: string } {
  if (message.includes('ECONNREFUSED')) {
    return {
      title: 'Ollama is not running',
      suggestion: 'Start it with `ollama serve` in your terminal.',
    }
  }
  if (message.includes('model not found') || message.includes('model_not_found')) {
    return {
      title: 'Model not installed',
      suggestion: 'Run `ollama pull <model>` to install the required model.',
    }
  }
  if (message.includes('API key') || message.includes('api_key') || message.includes('unauthorized')) {
    return {
      title: 'API key missing or invalid',
      suggestion: 'settings-link',
    }
  }
  return {
    title: 'Something went wrong',
    suggestion: message,
  }
}

export function ErrorDisplay({ error }: { error: Error }) {
  const { title, suggestion } = mapError(error.message)

  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
      <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-red-800 dark:text-red-200">{title}</p>
        {suggestion === 'settings-link' ? (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            Add your API key in <Link href="/settings" className="underline font-medium">Settings</Link>.
          </p>
        ) : (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{suggestion}</p>
        )}
      </div>
    </div>
  )
}
