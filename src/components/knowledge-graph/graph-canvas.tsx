'use client'

import { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import { Network, X } from 'lucide-react'
import { GraphSkeleton } from '@/components/shared/skeletons'
import { EmptyState } from '@/components/shared/empty-state'
import { Badge } from '@/components/ui/badge'
import { useGraphVisualization } from '@/hooks/use-graph-visualization'
import type { GraphElements, NodeData } from '@/lib/graph-transforms'

type GraphCanvasProps = {
  elements: GraphElements | undefined
  isLoading: boolean
  layout: string
  searchQuery: string
  onNodeDoubleClick?: (nodeId: string) => void
}

export function GraphCanvas({ elements, isLoading, layout, searchQuery, onNodeDoubleClick }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null)
  const [connectedNodes, setConnectedNodes] = useState<Array<{ name: string; relationship: string }>>([])

  const handleNodeClick = useCallback((data: Record<string, unknown>) => {
    setSelectedNode(data as unknown as NodeData)
    if (elements) {
      const nodeId = data.id as string
      const connected: Array<{ name: string; relationship: string }> = []
      for (const edge of elements.edges) {
        if (edge.data.source === nodeId) {
          const target = elements.nodes.find((n) => n.data.id === edge.data.target)
          if (target) connected.push({ name: target.data.symbolName, relationship: edge.data.relationshipType })
        }
        if (edge.data.target === nodeId) {
          const source = elements.nodes.find((n) => n.data.id === edge.data.source)
          if (source) connected.push({ name: source.data.symbolName, relationship: edge.data.relationshipType })
        }
      }
      setConnectedNodes(connected)
    }
  }, [elements])

  const handleNodeDblClick = useCallback((nodeId: string) => {
    onNodeDoubleClick?.(nodeId)
  }, [onNodeDoubleClick])

  const vizOptions = useMemo(() => ({
    layout,
    onNodeClick: handleNodeClick,
    onNodeDoubleClick: handleNodeDblClick,
  }), [layout, handleNodeClick, handleNodeDblClick])

  const { highlightNodes, dimNonMatching, zoomToNodes } = useGraphVisualization(containerRef, elements, vizOptions)

  useEffect(() => {
    if (!elements || !searchQuery) {
      highlightNodes([])
      dimNonMatching([])
      return
    }
    const query = searchQuery.toLowerCase()
    const matching = elements.nodes
      .filter((n) => n.data.symbolName.toLowerCase().includes(query))
      .map((n) => n.data.id)
    highlightNodes(matching)
    dimNonMatching(matching)
    if (matching.length) zoomToNodes(matching)
  }, [searchQuery, elements, highlightNodes, dimNonMatching, zoomToNodes])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && selectedNode) {
        setSelectedNode(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedNode])

  if (isLoading) {
    return (
      <div className="flex-1 p-4" data-testid="graph-loading">
        <GraphSkeleton />
      </div>
    )
  }

  if (!elements || (elements.nodes.length === 0 && elements.edges.length === 0)) {
    return (
      <div className="flex flex-1 items-center justify-center" data-testid="graph-empty">
        <EmptyState
          icon={Network}
          heading="No graph data"
          description="Index a repository to see code relationships visualized here."
        />
      </div>
    )
  }

  return (
    <div className="relative flex-1">
      <div ref={containerRef} className="h-full w-full" data-testid="graph-canvas" />

      {selectedNode && (
        <div
          className="absolute right-4 top-4 z-10 w-72 rounded-lg border bg-popover p-4 shadow-lg"
          data-testid="node-detail"
        >
          <div className="flex items-start justify-between gap-2">
            <code className="text-sm font-mono font-semibold break-all">{selectedNode.symbolName}</code>
            <button
              onClick={() => setSelectedNode(null)}
              className="shrink-0 rounded-sm p-0.5 hover:bg-accent"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {selectedNode.filePath && (
            <p className="mt-1 text-xs text-muted-foreground font-mono truncate" title={selectedNode.filePath}>
              {selectedNode.filePath}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="secondary" className="text-xs capitalize">
              {selectedNode.symbolType ?? 'unknown'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {connectedNodes.length} connection{connectedNodes.length !== 1 ? 's' : ''}
            </span>
          </div>
          {connectedNodes.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Connected to:</p>
              {connectedNodes.slice(0, 10).map((c, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground capitalize">{c.relationship}</span>
                  <code className="font-mono truncate">{c.name}</code>
                </div>
              ))}
              {connectedNodes.length > 10 && (
                <p className="text-xs text-muted-foreground">and {connectedNodes.length - 10} more</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
