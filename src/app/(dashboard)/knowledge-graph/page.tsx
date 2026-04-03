'use client'

import { useState, useCallback, useMemo } from 'react'
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
  const [showCrossRepo, setShowCrossRepo] = useState(false)
  const [confidenceThreshold, setConfidenceThreshold] = useState(0)

  const { repos } = useRepos()

  const combinedFilters = useMemo<GraphFilters>(() => ({
    ...filters,
    showCrossRepo,
    confidenceThreshold: showCrossRepo ? confidenceThreshold : undefined,
  }), [filters, showCrossRepo, confidenceThreshold])

  const { edges, elements, isLoading, expandNode } = useGraphData(combinedFilters)

  // Always enable the cross-repo toggle. The actual data check happens server-side;
  // when the user enables cross-repo mode, the API fetches cross-repo edges.
  // Without a separate probe endpoint, checking from the filtered edges creates
  // a chicken-and-egg problem (toggle disabled because data not fetched, data not
  // fetched because toggle disabled).
  const hasCrossRepoData = repos.length > 1

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
        showCrossRepo={showCrossRepo}
        onShowCrossRepoChange={setShowCrossRepo}
        confidenceThreshold={confidenceThreshold}
        onConfidenceThresholdChange={setConfidenceThreshold}
        hasCrossRepoData={hasCrossRepoData}
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
