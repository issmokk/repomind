'use client'

import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Check, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export type ProviderStatus = {
  name: string
  configured: boolean
}

type ProviderChainProps = {
  providerOrder: string[]
  providers: ProviderStatus[]
  onReorder: (newOrder: string[]) => void
}

function SortableProvider({ provider }: { provider: ProviderStatus }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: provider.name })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-card p-3"
      role="listitem"
    >
      <button {...attributes} {...listeners} className="cursor-grab touch-none" aria-label="Drag to reorder">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <span className="text-sm font-medium capitalize flex-1">{provider.name}</span>
      {provider.configured ? (
        <Badge variant="secondary" className="gap-1">
          <Check className="h-3 w-3" />
          Configured
        </Badge>
      ) : (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <AlertCircle className="h-3 w-3" />
          Not configured
        </Badge>
      )}
    </li>
  )
}

export function ProviderChain({ providerOrder, providers, onReorder }: ProviderChainProps) {
  const orderedProviders = providerOrder
    .map((name) => providers.find((p) => p.name === name))
    .filter((p): p is ProviderStatus => !!p)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = providerOrder.indexOf(active.id as string)
    const newIndex = providerOrder.indexOf(over.id as string)
    onReorder(arrayMove(providerOrder, oldIndex, newIndex))
  }

  return (
    <div>
      <p className="text-sm font-medium mb-2">Provider Fallback Chain</p>
      <p className="text-xs text-muted-foreground mb-3">
        Drag to reorder. The first configured provider will be used for LLM queries.
      </p>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={providerOrder} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2" role="list">
            {orderedProviders.map((provider) => (
              <SortableProvider key={provider.name} provider={provider} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  )
}
