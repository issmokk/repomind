'use client'

const NODE_TYPES = [
  { label: 'Function', color: '#3b82f6', shape: 'rounded-full' },
  { label: 'Class', color: '#8b5cf6', shape: 'rounded-sm' },
  { label: 'File', color: '#6b7280', shape: 'rotate-45 rounded-sm' },
  { label: 'Module', color: '#22c55e', shape: 'rounded-full' },
  { label: 'Package', color: '#f59e0b', shape: 'rounded-full' },
]

const EDGE_TYPES = [
  { label: 'Calls', style: 'border-solid' },
  { label: 'Imports', style: 'border-dashed' },
  { label: 'Inherits', style: 'border-dotted' },
  { label: 'Composes', style: 'border-solid border-2' },
  { label: 'Depends on', style: 'border-solid opacity-50' },
]

export function GraphLegend() {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">Node Types</p>
        <div className="space-y-1">
          {NODE_TYPES.map((t) => (
            <div key={t.label} className="flex items-center gap-2">
              <span
                className={`inline-block h-3 w-3 shrink-0 ${t.shape}`}
                style={{ backgroundColor: t.color }}
              />
              <span className="text-xs text-muted-foreground">{t.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">Edge Types</p>
        <div className="space-y-1">
          {EDGE_TYPES.map((t) => (
            <div key={t.label} className="flex items-center gap-2">
              <span className={`inline-block h-0 w-4 border-t border-muted-foreground ${t.style}`} />
              <span className="text-xs text-muted-foreground">{t.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
