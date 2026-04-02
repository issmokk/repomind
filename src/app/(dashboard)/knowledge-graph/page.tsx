'use client'

import { useState, useCallback } from 'react'
import { ControlsPanel } from '@/components/knowledge-graph/controls-panel'
import { GraphCanvas } from '@/components/knowledge-graph/graph-canvas'
import { TreeView } from '@/components/knowledge-graph/tree-view'
import { ViewToggle, type ViewMode } from '@/components/knowledge-graph/view-toggle'
import { useGraphData, type GraphFilters } from '@/hooks/use-graph-data'
import { useRepos } from '@/hooks/use-repos'

export default function KnowledgeGraphPage() {
  const [layout, setLayout] = useState('cose')
  const [filters, setFilters] = useState<GraphFilters>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('graph')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const { repos } = useRepos()
  const { edges, elements, isLoading, expandNode } = useGraphData(filters)

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    expandNode(nodeId)
  }, [expandNode])

  const repoName = repos.length > 0 ? repos[0].fullName : 'Repository'

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
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>
        {viewMode === 'graph' ? (
          <GraphCanvas
            elements={elements}
            isLoading={isLoading}
            layout={layout}
            searchQuery={searchQuery}
            onNodeDoubleClick={handleNodeDoubleClick}
          />
        ) : (
          <TreeView
            edges={edges}
            repoName={repoName}
            selectedNodeId={selectedNodeId}
            onSelect={setSelectedNodeId}
          />
        )}
      </div>
    </div>
  )
}
