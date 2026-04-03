'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { FolderTree } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { TreeNode } from './tree-node'
import { useTreeData, type TreeNodeData } from '@/hooks/use-tree-data'
import type { GraphEdge } from '@/types/graph'

type FlatItem = {
  node: TreeNodeData
  depth: number
}

function flattenTree(roots: TreeNodeData[], expandedIds: Set<string>): FlatItem[] {
  const result: FlatItem[] = []
  const stack: Array<{ node: TreeNodeData; depth: number }> = []
  for (let i = roots.length - 1; i >= 0; i--) {
    stack.push({ node: roots[i], depth: 0 })
  }
  while (stack.length > 0) {
    const { node, depth } = stack.pop()!
    result.push({ node, depth })
    if (expandedIds.has(node.id) && node.children.length > 0) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push({ node: node.children[i], depth: depth + 1 })
      }
    }
  }
  return result
}

export type TreeViewProps = {
  edges: GraphEdge[]
  repoName: string
  selectedNodeId: string | null
  onSelect: (id: string) => void
}

export function TreeView({ edges, repoName, selectedNodeId, onSelect }: TreeViewProps) {
  const tree = useTreeData(edges, repoName)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (!tree) return new Set<string>()
    return new Set([tree.id])
  })
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (tree) {
      setExpandedIds(new Set([tree.id]))
    }
  }, [tree])

  const flatItems = useMemo(() => {
    if (!tree) return []
    return flattenTree([tree], expandedIds)
  }, [tree, expandedIds])

  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 28,
    overscan: 10,
  })

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  if (!tree || edges.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center" data-testid="tree-empty">
        <EmptyState
          icon={FolderTree}
          heading="No tree data"
          description="Index a repository to see the code structure here."
        />
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-auto" data-testid="tree-view">
      <div
        style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = flatItems[virtualRow.index]
          return (
            <div
              key={item.node.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <TreeNode
                node={item.node}
                depth={item.depth}
                expandedIds={expandedIds}
                selectedId={selectedNodeId}
                onToggle={handleToggle}
                onSelect={onSelect}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
