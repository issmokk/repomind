'use client'

import { useState, useCallback } from 'react'
import { ControlsPanel } from '@/components/knowledge-graph/controls-panel'
import { GraphCanvas } from '@/components/knowledge-graph/graph-canvas'
import { useGraphData, type GraphFilters } from '@/hooks/use-graph-data'
import { useRepos } from '@/hooks/use-repos'

export default function KnowledgeGraphPage() {
  const [layout, setLayout] = useState('cose')
  const [filters, setFilters] = useState<GraphFilters>({})
  const [searchQuery, setSearchQuery] = useState('')

  const { repos } = useRepos()
  const { elements, isLoading, expandNode } = useGraphData(filters)

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    expandNode(nodeId)
  }, [expandNode])

  return (
    <div className="flex h-full">
      <ControlsPanel
        repos={repos.map((r) => ({ id: r.id, fullName: r.fullName }))}
        layout={layout}
        onLayoutChange={setLayout}
        filters={filters}
        onFilterChange={setFilters}
        onSearch={handleSearch}
      />
      <GraphCanvas
        elements={elements}
        isLoading={isLoading}
        layout={layout}
        searchQuery={searchQuery}
        onNodeDoubleClick={handleNodeDoubleClick}
      />
    </div>
  )
}
