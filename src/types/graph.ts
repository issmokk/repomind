export type RelationshipType =
  | 'calls'
  | 'imports'
  | 'inherits'
  | 'composes'
  | 'depends_on'
  | 'external_dep'
  | 'gem_dependency'
  | 'npm_dependency'
  | 'event_publish'
  | 'event_subscribe'

export type GraphEdge = {
  id: number
  repoId: string
  targetRepoId: string | null
  sourceFile: string
  sourceSymbol: string
  sourceType: string | null
  targetFile: string | null
  targetSymbol: string
  targetType: string | null
  relationshipType: RelationshipType
  metadata: Record<string, unknown>
  confidence: number | null
  createdAt: string
}

export type GraphEdgeInsert = Omit<GraphEdge, 'id' | 'createdAt'>
