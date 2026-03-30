'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type SearchConfigProps = {
  maxGraphHops: number
  searchTopK: number
  searchRrfK: number
  onChange: (field: string, value: number) => void
}

export function SearchConfig({ maxGraphHops, searchTopK, searchRrfK, onChange }: SearchConfigProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Max Graph Hops</Label>
          <span className="text-xs font-mono text-muted-foreground">{maxGraphHops}</span>
        </div>
        <input
          type="range"
          min={0}
          max={5}
          step={1}
          value={maxGraphHops}
          onChange={(e) => onChange('maxGraphHops', parseInt(e.target.value))}
          className="w-full accent-primary"
          aria-label="Max graph hops"
          aria-valuemin={0}
          aria-valuemax={5}
          aria-valuenow={maxGraphHops}
        />
        <p className="text-xs text-muted-foreground">
          Number of relationship hops to traverse in the knowledge graph when expanding search context.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Search Top-K</Label>
          <span className="text-xs font-mono text-muted-foreground">{searchTopK}</span>
        </div>
        <input
          type="range"
          min={1}
          max={50}
          step={1}
          value={searchTopK}
          onChange={(e) => onChange('searchTopK', parseInt(e.target.value))}
          className="w-full accent-primary"
          aria-label="Search top K"
          aria-valuemin={1}
          aria-valuemax={50}
          aria-valuenow={searchTopK}
        />
        <p className="text-xs text-muted-foreground">
          Number of top matching code chunks to retrieve for each query.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">RRF K Parameter</Label>
        <Input
          type="number"
          min={1}
          max={100}
          value={searchRrfK}
          onChange={(e) => onChange('searchRrfK', parseInt(e.target.value) || 60)}
          className="w-24"
          data-testid="input-searchRrfK"
        />
        <p className="text-xs text-muted-foreground">
          Reciprocal Rank Fusion constant. Higher values give more weight to lower-ranked results.
        </p>
      </div>
    </div>
  )
}
