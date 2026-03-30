'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { GraphLegend } from './graph-legend'
import type { GraphFilters } from '@/hooks/use-graph-data'

const LAYOUTS = [
  { value: 'cose', label: 'Force-directed' },
  { value: 'dagre', label: 'Hierarchical' },
  { value: 'circle', label: 'Circular' },
  { value: 'breadthfirst', label: 'Breadthfirst' },
]

const SYMBOL_TYPES = ['function', 'class', 'module', 'file', 'package']
const RELATIONSHIP_TYPES = ['calls', 'imports', 'inherits', 'composes', 'depends_on', 'external_dep']

export type ControlsPanelProps = {
  repos: Array<{ id: string; fullName: string }>
  layout: string
  onLayoutChange: (layout: string) => void
  filters: GraphFilters
  onFilterChange: (filters: GraphFilters) => void
  onSearch: (query: string) => void
}

export function ControlsPanel({
  repos,
  layout,
  onLayoutChange,
  filters,
  onFilterChange,
  onSearch,
}: ControlsPanelProps) {
  const [searchInput, setSearchInput] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(searchInput)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, onSearch])

  function toggleRepoId(repoId: string) {
    const current = filters.repoIds ?? repos.map((r) => r.id)
    const next = current.includes(repoId) ? current.filter((id) => id !== repoId) : [...current, repoId]
    onFilterChange({ ...filters, repoIds: next.length === repos.length ? undefined : next })
  }

  function toggleSymbolType(type: string) {
    const current = filters.symbolTypes ?? SYMBOL_TYPES
    const next = current.includes(type) ? current.filter((t) => t !== type) : [...current, type]
    onFilterChange({ ...filters, symbolTypes: next.length === SYMBOL_TYPES.length ? undefined : next })
  }

  function toggleRelationshipType(type: string) {
    const current = filters.relationshipTypes ?? RELATIONSHIP_TYPES
    const next = current.includes(type) ? current.filter((t) => t !== type) : [...current, type]
    onFilterChange({
      ...filters,
      relationshipTypes: next.length === RELATIONSHIP_TYPES.length ? undefined : next,
    })
  }

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col gap-5 overflow-y-auto border-r p-4" data-testid="controls-panel">
      <div>
        <Label className="mb-1.5 text-xs font-medium">Layout</Label>
        <Select value={layout} onValueChange={(val) => onLayoutChange(val as string)}>
          <SelectTrigger className="w-full" data-testid="layout-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LAYOUTS.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search nodes..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-8 h-8 text-sm"
          data-testid="graph-search"
        />
      </div>

      {repos.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Repositories</p>
          <div className="space-y-1.5">
            {repos.map((repo) => {
              const checked = !(filters.repoIds) || filters.repoIds.includes(repo.id)
              return (
                <label key={repo.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={checked} onCheckedChange={() => toggleRepoId(repo.id)} />
                  <span className="text-xs truncate">{repo.fullName}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Node Types</p>
        <div className="space-y-1.5">
          {SYMBOL_TYPES.map((type) => {
            const checked = !(filters.symbolTypes) || filters.symbolTypes.includes(type)
            return (
              <label key={type} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={checked} onCheckedChange={() => toggleSymbolType(type)} />
                <span className="text-xs capitalize">{type}</span>
              </label>
            )
          })}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Relationships</p>
        <div className="space-y-1.5">
          {RELATIONSHIP_TYPES.map((type) => {
            const checked = !(filters.relationshipTypes) || filters.relationshipTypes.includes(type)
            return (
              <label key={type} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={checked} onCheckedChange={() => toggleRelationshipType(type)} />
                <span className="text-xs capitalize">{type.replace('_', ' ')}</span>
              </label>
            )
          })}
        </div>
      </div>

      <GraphLegend />
    </div>
  )
}
