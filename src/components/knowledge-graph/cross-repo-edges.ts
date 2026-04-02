export const CROSS_REPO_RELATIONSHIP_TYPES = [
  'gem_dependency',
  'npm_dependency',
  'event_publish',
  'event_subscribe',
] as const

const CROSS_REPO_EDGE_STYLES: Record<string, { lineStyle: string; color: string; width: number }> = {
  gem_dependency: { lineStyle: 'dashed', color: '#f97316', width: 2 },
  npm_dependency: { lineStyle: 'dashed', color: '#22c55e', width: 2 },
  event_publish: { lineStyle: 'dashed', color: '#a855f7', width: 2 },
  event_subscribe: { lineStyle: 'dashed', color: '#a855f7', width: 2 },
}

const DEFAULT_CROSS_REPO_STYLE = { lineStyle: 'dashed', color: '#94a3b8', width: 1 }

export function getCrossRepoEdgeStyle(relationshipType: string) {
  return CROSS_REPO_EDGE_STYLES[relationshipType] ?? DEFAULT_CROSS_REPO_STYLE
}

export function getCrossRepoNodeLabel(symbolName: string, repoName: string) {
  return `${repoName}:${symbolName}`
}

export function isCrossRepoEdge(edge: { repoId: string; targetRepoId: string | null }) {
  return edge.targetRepoId !== null && edge.targetRepoId !== edge.repoId
}
