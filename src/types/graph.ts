export type RelationshipType =
  | 'calls'
  | 'imports'
  | 'inherits'
  | 'composes'
  | 'depends_on'
  | 'external_dep'

export type GraphEdge = {
  id: number
  repoId: string
  sourceFile: string
  sourceSymbol: string
  sourceType: string | null
  targetFile: string | null
  targetSymbol: string
  targetType: string | null
  relationshipType: RelationshipType
  metadata: Record<string, unknown>
  createdAt: string
}

export type GraphEdgeInsert = Omit<GraphEdge, 'id' | 'createdAt'>
