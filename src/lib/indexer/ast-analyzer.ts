import { SUPPORTED_LANGUAGES } from './languages'
import { getLanguageConfig } from './queries'

export type SymbolType = 'function' | 'method' | 'class' | 'module' | 'interface' | 'type_alias'

export interface SymbolInfo {
  type: SymbolType
  name: string
  filePath: string
  startLine: number
  endLine: number
  parentScope: string | null
  rawText: string
}

interface TreeNode {
  type: string
  text: string
  startPosition: { row: number; column: number }
  endPosition: { row: number; column: number }
  parent: TreeNode | null
  children: TreeNode[]
  childCount: number
}

interface Tree {
  rootNode: TreeNode
}

export function detectLanguage(filePath: string): string | null {
  const ext = '.' + (filePath.split('.').pop() ?? '')
  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang.extensions.includes(ext)) return lang.name
  }
  return null
}

function buildParentScope(node: TreeNode, scopeTypes: Set<string>, getNameFn: (n: unknown) => string | null): string | null {
  const scopes: string[] = []
  let current = node.parent
  while (current) {
    if (scopeTypes.has(current.type)) {
      const name = getNameFn(current)
      if (name) scopes.unshift(name)
    }
    current = current.parent
  }
  return scopes.length > 0 ? scopes.join('.') : null
}

function walkTree(node: TreeNode, visitor: (n: TreeNode) => void): void {
  visitor(node)
  for (let i = 0; i < node.childCount; i++) {
    walkTree(node.children[i], visitor)
  }
}

export function extractSymbols(
  tree: Tree,
  language: string,
  filePath: string,
): SymbolInfo[] {
  const config = getLanguageConfig(language)
  if (!config) return []

  const symbols: SymbolInfo[] = []

  walkTree(tree.rootNode, (node) => {
    const symbolType = config.symbolNodeTypes[node.type]
    const isArrow = config.isArrowFunction?.(node)

    if (!symbolType && !isArrow) return

    const name = config.getSymbolName(node)
    if (!name) return

    const type = isArrow ? 'function' : symbolType!
    const parentScope = buildParentScope(node, config.scopeNodeTypes, config.getSymbolName)

    try {
      symbols.push({
        type,
        name,
        filePath,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        parentScope,
        rawText: node.text ?? '',
      })
    } catch {
      // skip nodes with missing properties
    }
  })

  return symbols
}
