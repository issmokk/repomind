import type { ImportInfo, CallSiteInfo, InheritanceInfo } from './ast-analyzer'
import type { GraphEdgeInsert, RelationshipType as _RelationshipType } from '@/types/graph'
import { resolveImport } from './import-resolver'

export interface ASTAnalysisResult {
  imports: ImportInfo[]
  callSites: CallSiteInfo[]
  inheritance: InheritanceInfo[]
  composition: InheritanceInfo[]
}

export interface GraphBuilderOptions {
  repoId: string
  fileTree: string[]
  language: string
}

export function buildGraphEdges(
  filePath: string,
  analysis: ASTAnalysisResult,
  options: GraphBuilderOptions,
): GraphEdgeInsert[] {
  const edges: GraphEdgeInsert[] = []
  const fileSet = new Set(options.fileTree)
  const importMap = new Map<string, string | null>()

  for (const imp of analysis.imports) {
    const resolved = resolveImport(imp.source, filePath, options.fileTree, options.language, fileSet)

    if (resolved.isExternal) {
      edges.push({
        repoId: options.repoId,
        targetRepoId: null,
        sourceFile: filePath,
        sourceSymbol: filePath,
        sourceType: 'file',
        targetFile: null,
        targetSymbol: resolved.packageName ?? imp.source,
        targetType: 'package',
        relationshipType: 'external_dep',
        metadata: {
          package_name: resolved.packageName ?? imp.source,
          import_path: imp.source,
        },
      })
    } else {
      edges.push({
        repoId: options.repoId,
        targetRepoId: null,
        sourceFile: filePath,
        sourceSymbol: filePath,
        sourceType: 'file',
        targetFile: resolved.resolvedPath,
        targetSymbol: imp.source,
        targetType: 'module',
        relationshipType: 'imports',
        metadata: { imported_names: imp.importedNames },
      })
    }

    for (const name of imp.importedNames) {
      importMap.set(name, resolved.resolvedPath)
    }
  }

  for (const call of analysis.callSites) {
    const receiver = call.receiver
    const baseName = call.calleeName.includes('.') ? call.calleeName.split('.')[0] : call.calleeName
    const targetFile = importMap.get(baseName) ?? (receiver ? importMap.get(receiver) : null) ?? null

    edges.push({
      repoId: options.repoId,
      targetRepoId: null,
      sourceFile: filePath,
      sourceSymbol: call.containingScope || filePath,
      sourceType: 'function',
      targetFile,
      targetSymbol: call.calleeName,
      targetType: 'function',
      relationshipType: 'calls',
      metadata: { line: call.line },
    })
  }

  for (const inh of analysis.inheritance) {
    const parentFile = importMap.get(inh.parentName) ?? null
    edges.push({
      repoId: options.repoId,
      targetRepoId: null,
      sourceFile: filePath,
      sourceSymbol: inh.childName,
      sourceType: 'class',
      targetFile: parentFile,
      targetSymbol: inh.parentName,
      targetType: 'class',
      relationshipType: 'inherits',
      metadata: { kind: inh.kind },
    })
  }

  for (const comp of analysis.composition) {
    const targetFile = importMap.get(comp.parentName) ?? null
    edges.push({
      repoId: options.repoId,
      targetRepoId: null,
      sourceFile: filePath,
      sourceSymbol: comp.childName,
      sourceType: 'class',
      targetFile,
      targetSymbol: comp.parentName,
      targetType: 'module',
      relationshipType: 'composes',
      metadata: { kind: comp.kind },
    })
  }

  return deduplicateEdges(edges)
}

function deduplicateEdges(edges: GraphEdgeInsert[]): GraphEdgeInsert[] {
  const seen = new Set<string>()
  return edges.filter((edge) => {
    const key = `${edge.sourceFile}:${edge.sourceSymbol}:${edge.targetFile}:${edge.targetSymbol}:${edge.relationshipType}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
