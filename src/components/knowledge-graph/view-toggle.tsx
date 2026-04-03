'use client'

import { Network, FolderTree } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ViewMode = 'graph' | 'tree'

export type ViewToggleProps = {
  value: ViewMode
  onChange: (value: ViewMode) => void
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-md border" data-testid="view-toggle">
      <button
        onClick={() => onChange('graph')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
          value === 'graph' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
        )}
        data-testid="view-toggle-graph"
      >
        <Network className="h-3.5 w-3.5" />
        Graph
      </button>
      <button
        onClick={() => onChange('tree')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
          value === 'tree' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
        )}
        data-testid="view-toggle-tree"
      >
        <FolderTree className="h-3.5 w-3.5" />
        Tree
      </button>
    </div>
  )
}
