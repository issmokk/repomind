'use client'

import { ChevronRight, Folder, File, Braces, FunctionSquare, Package, GitBranch } from 'lucide-react'
import type { TreeNodeData } from '@/hooks/use-tree-data'
import { cn } from '@/lib/utils'

const TYPE_ICONS: Record<string, typeof Folder> = {
  repo: GitBranch,
  directory: Folder,
  file: File,
  class: Braces,
  function: FunctionSquare,
  method: FunctionSquare,
  module: Package,
}

export type TreeNodeProps = {
  node: TreeNodeData
  depth: number
  expandedIds: Set<string>
  selectedId: string | null
  onToggle: (id: string) => void
  onSelect: (id: string) => void
}

export function TreeNode({ node, depth, expandedIds, selectedId, onToggle, onSelect }: TreeNodeProps) {
  const hasChildren = node.children.length > 0
  const isExpanded = expandedIds.has(node.id)
  const isSelected = selectedId === node.id
  const Icon = TYPE_ICONS[node.type] ?? File

  function handleClick() {
    if (hasChildren) onToggle(node.id)
    onSelect(node.id)
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-sm px-1.5 py-1 text-left text-xs hover:bg-accent',
        isSelected && 'bg-accent',
      )}
      style={{ paddingLeft: `${depth * 16 + 6}px` }}
      data-testid={`tree-node-${node.id}`}
    >
      {hasChildren ? (
        <ChevronRight
          className={cn('h-3 w-3 shrink-0 transition-transform', isExpanded && 'rotate-90')}
        />
      ) : (
        <span className="w-3 shrink-0" />
      )}
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{node.name}</span>
      {node.edgeCount > 0 && (
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
          {node.edgeCount} dep{node.edgeCount !== 1 ? 's' : ''}
        </span>
      )}
    </button>
  )
}
