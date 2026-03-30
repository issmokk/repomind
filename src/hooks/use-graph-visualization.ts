'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import type { GraphElements } from '@/lib/graph-transforms'
import type cytoscape from 'cytoscape'

const NODE_STYLES: Record<string, { shape: string; color: string }> = {
  function: { shape: 'ellipse', color: '#3b82f6' },
  class: { shape: 'rectangle', color: '#8b5cf6' },
  file: { shape: 'diamond', color: '#6b7280' },
  module: { shape: 'hexagon', color: '#22c55e' },
  package: { shape: 'octagon', color: '#f59e0b' },
}

const EDGE_STYLES: Record<string, { lineStyle: string; width: number; color: string }> = {
  calls: { lineStyle: 'solid', width: 2, color: '#64748b' },
  imports: { lineStyle: 'dashed', width: 2, color: '#64748b' },
  inherits: { lineStyle: 'dotted', width: 2, color: '#64748b' },
  composes: { lineStyle: 'solid', width: 3, color: '#64748b' },
  depends_on: { lineStyle: 'solid', width: 1, color: '#94a3b8' },
  external_dep: { lineStyle: 'dashed', width: 1, color: '#94a3b8' },
}

const DEFAULT_NODE_STYLE = { shape: 'ellipse', color: '#6b7280' }
const DEFAULT_EDGE_STYLE = { lineStyle: 'solid', width: 1, color: '#94a3b8' }

let dagreRegistered = false

type Options = {
  layout: string
  onNodeClick?: (nodeData: Record<string, unknown>) => void
  onNodeDoubleClick?: (nodeId: string) => void
}

export function useGraphVisualization(
  containerRef: React.RefObject<HTMLDivElement | null>,
  elements: GraphElements | undefined,
  options: Options,
) {
  const cyRef = useRef<cytoscape.Core | null>(null)
  const [cyReady, setCyReady] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    async function init() {
      const [{ default: cytoscape }, { default: dagre }] = await Promise.all([
        import('cytoscape'),
        import('cytoscape-dagre'),
      ])
      if (cancelled) return

      if (!dagreRegistered) {
        cytoscape.use(dagre as never)
        dagreRegistered = true
      }

      const cy = cytoscape({
        container: containerRef.current,
        style: [
          {
            selector: 'node',
            style: {
              label: 'data(symbolName)',
              'text-max-width': '100px' as never,
              'text-wrap': 'ellipsis' as never,
              'font-size': '11px',
              color: '#e2e8f0',
              'text-outline-color': '#0f172a',
              'text-outline-width': 1,
              'text-valign': 'bottom',
              'text-margin-y': 4,
              width: 'mapData(degree, 0, 20, 30, 80)' as never,
              height: 'mapData(degree, 0, 20, 30, 80)' as never,
            },
          },
          ...Object.entries(NODE_STYLES).map(([type, { shape, color }]) => ({
            selector: `node[symbolType = "${type}"]`,
            style: {
              shape: shape as never,
              'background-color': color,
              'border-color': color,
              'border-width': 1,
            },
          })),
          {
            selector: 'node[!symbolType]',
            style: {
              shape: DEFAULT_NODE_STYLE.shape as never,
              'background-color': DEFAULT_NODE_STYLE.color,
            },
          },
          {
            selector: 'edge',
            style: {
              'curve-style': 'bezier' as never,
              'target-arrow-shape': 'triangle',
              'arrow-scale': 0.8,
            },
          },
          ...Object.entries(EDGE_STYLES).map(([type, { lineStyle, width, color }]) => ({
            selector: `edge[relationshipType = "${type}"]`,
            style: {
              'line-style': lineStyle as never,
              width,
              'line-color': color,
              'target-arrow-color': color,
            },
          })),
          {
            selector: 'edge[!relationshipType]',
            style: {
              'line-style': DEFAULT_EDGE_STYLE.lineStyle as never,
              width: DEFAULT_EDGE_STYLE.width,
              'line-color': DEFAULT_EDGE_STYLE.color,
            },
          },
          {
            selector: 'node.dimmed',
            style: { opacity: 0.15 },
          },
          {
            selector: 'edge.dimmed',
            style: { opacity: 0.08 },
          },
          {
            selector: 'node.highlighted',
            style: {
              'border-width': 3,
              'border-color': '#facc15',
            },
          },
        ] as never,
        layout: { name: 'preset' },
        wheelSensitivity: 0.3,
      })

      cyRef.current = cy
      setCyReady(true)
    }

    init()
    return () => {
      cancelled = true
      cyRef.current?.destroy()
      cyRef.current = null
      setCyReady(false)
    }
  }, [containerRef])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !cyReady) return

    const tapHandler = (e: cytoscape.EventObject) => {
      options.onNodeClick?.(e.target.data())
    }
    const dbltapHandler = (e: cytoscape.EventObject) => {
      options.onNodeDoubleClick?.(e.target.id())
    }

    cy.on('tap', 'node', tapHandler)
    cy.on('dbltap', 'node', dbltapHandler)

    return () => {
      cy.off('tap', 'node', tapHandler)
      cy.off('dbltap', 'node', dbltapHandler)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depend on callbacks + cyReady, not the full options object
  }, [cyReady, options.onNodeClick, options.onNodeDoubleClick])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !cyReady || !elements) return

    const currentNodeIds = new Set(cy.nodes().map((n) => n.id()))
    const currentEdgeIds = new Set(cy.edges().map((e) => e.id()))

    const newNodeIds = new Set(elements.nodes.map((n) => n.data.id))
    const newEdgeIds = new Set(elements.edges.map((e) => e.data.id))

    const nodesToRemove = cy.nodes().filter((n) => !newNodeIds.has(n.id()))
    const edgesToRemove = cy.edges().filter((e) => !newEdgeIds.has(e.id()))

    const nodesToAdd = elements.nodes.filter((n) => !currentNodeIds.has(n.data.id))
    const edgesToAdd = elements.edges.filter((e) => !currentEdgeIds.has(e.data.id))

    cy.batch(() => {
      if (nodesToRemove.length) nodesToRemove.remove()
      if (edgesToRemove.length) edgesToRemove.remove()
      if (nodesToAdd.length) cy.add(nodesToAdd as never)
      if (edgesToAdd.length) cy.add(edgesToAdd as never)
    })

    const isLargeGraph = elements.nodes.length > 300
    cy.layout({
      name: options.layout === 'dagre' ? 'dagre' : options.layout,
      animate: !isLargeGraph,
      animationDuration: 500,
      ...(options.layout === 'dagre' ? { rankDir: 'TB' } : {}),
    } as never).run()
  }, [elements, options.layout, cyReady])

  const fitToView = useCallback(() => {
    cyRef.current?.fit(undefined, 40)
  }, [])

  const highlightNodes = useCallback((ids: string[]) => {
    const cy = cyRef.current
    if (!cy) return
    cy.nodes().removeClass('highlighted')
    const idSet = new Set(ids)
    cy.nodes().filter((n) => idSet.has(n.id())).addClass('highlighted')
  }, [])

  const dimNonMatching = useCallback((matchingIds: string[]) => {
    const cy = cyRef.current
    if (!cy) return
    cy.elements().removeClass('dimmed')
    if (!matchingIds.length) return
    const idSet = new Set(matchingIds)
    cy.nodes().filter((n) => !idSet.has(n.id())).addClass('dimmed')
    cy.edges().filter((e) => !idSet.has(e.source().id()) && !idSet.has(e.target().id())).addClass('dimmed')
  }, [])

  const runLayout = useCallback((layoutName: string) => {
    const cy = cyRef.current
    if (!cy) return
    const isLarge = cy.nodes().length > 300
    cy.layout({
      name: layoutName === 'dagre' ? 'dagre' : layoutName,
      animate: !isLarge,
      animationDuration: 500,
      ...(layoutName === 'dagre' ? { rankDir: 'TB' } : {}),
    } as never).run()
  }, [])

  return { fitToView, highlightNodes, dimNonMatching, runLayout }
}
