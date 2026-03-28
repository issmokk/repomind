import { SUPPORTED_LANGUAGES } from './languages'
import { getSymbolQuery, getImportQuery, getInheritanceQuery, getCallQuery } from './queries'

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

export interface ImportInfo {
  source: string
  importedNames: string[]
  isRelative: boolean
  filePath: string
  line: number
  kind: 'require' | 'require_relative' | 'import' | 'dynamic_import' | 'include' | 'extend' | 're_export'
}

export interface CallSiteInfo {
  calleeName: string
  receiver: string | null
  containingScope: string
  filePath: string
  line: number
}

export interface InheritanceInfo {
  childName: string
  parentName: string
  kind: 'extends' | 'implements' | 'includes' | 'extend_module'
  filePath: string
  line: number
}

interface SyntaxNode {
  type: string
  text: string
  startPosition: { row: number; column: number }
  endPosition: { row: number; column: number }
  parent: SyntaxNode | null
  children: SyntaxNode[]
  childCount: number
}

interface Capture {
  name: string
  node: SyntaxNode
}

interface Query {
  captures(node: SyntaxNode): Capture[]
}

interface Language {
  query(source: string): Query
}

interface Tree {
  rootNode: SyntaxNode
}

const SCOPE_TYPES = new Set(['class', 'module', 'class_declaration', 'namespace', 'module'])
const NAME_TYPES = new Set(['constant', 'identifier', 'type_identifier', 'scope_resolution', 'property_identifier'])

export function detectLanguage(filePath: string): string | null {
  const ext = '.' + (filePath.split('.').pop() ?? '')
  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang.extensions.includes(ext)) return lang.name
  }
  return null
}

function buildParentScope(node: SyntaxNode): string | null {
  const scopes: string[] = []
  let current = node.parent
  while (current) {
    if (SCOPE_TYPES.has(current.type)) {
      const nameChild = current.children?.find((c) => NAME_TYPES.has(c.type))
      if (nameChild) scopes.unshift(nameChild.text)
    }
    current = current.parent
  }
  return scopes.length > 0 ? scopes.join('.') : null
}

function runQuery(language: Language, queryString: string, rootNode: SyntaxNode): Capture[] {
  try {
    const query = language.query(queryString)
    return query.captures(rootNode)
  } catch (err) {
    console.warn(`Tree-sitter query compilation failed: ${(err as Error).message}`)
    return []
  }
}

function mapSymbolType(captureName: string): SymbolType | null {
  if (captureName.startsWith('class.') || captureName === 'class.definition') return 'class'
  if (captureName.startsWith('module.') || captureName === 'module.definition') return 'module'
  if (captureName.startsWith('namespace.')) return 'module'
  if (captureName.startsWith('method.') || captureName === 'method.definition') return 'method'
  if (captureName.startsWith('singleton_method.')) return 'method'
  if (captureName.startsWith('function.') || captureName === 'function.definition') return 'function'
  if (captureName.startsWith('arrow.')) return 'function'
  if (captureName.startsWith('interface.') || captureName === 'interface.definition') return 'interface'
  if (captureName.startsWith('type_alias.')) return 'type_alias'
  return null
}

export async function extractSymbols(
  tree: Tree,
  language: string,
  filePath: string,
  lang?: Language,
): Promise<SymbolInfo[]> {
  const queryString = getSymbolQuery(language)
  if (!queryString || !lang) return []

  const captures = runQuery(lang, queryString, tree.rootNode)
  const symbols: SymbolInfo[] = []
  const seen = new Set<string>()

  for (const capture of captures) {
    if (!capture.name.endsWith('.name')) continue

    const symbolType = mapSymbolType(capture.name)
    if (!symbolType) continue

    const defCapture = captures.find(
      (c) => c.name.endsWith('.definition') && c.node.startPosition.row === capture.node.parent?.startPosition?.row,
    )
    const defNode = defCapture?.node ?? capture.node.parent

    if (!defNode) continue

    const key = `${symbolType}:${capture.node.text}:${defNode.startPosition.row}`
    if (seen.has(key)) continue
    seen.add(key)

    try {
      symbols.push({
        type: symbolType,
        name: capture.node.text,
        filePath,
        startLine: defNode.startPosition.row + 1,
        endLine: defNode.endPosition.row + 1,
        parentScope: buildParentScope(defNode),
        rawText: defNode.text ?? '',
      })
    } catch {
      // skip nodes with missing properties
    }
  }

  return symbols
}

export async function extractImports(
  tree: Tree,
  language: string,
  filePath: string,
  lang?: Language,
): Promise<ImportInfo[]> {
  const queryString = getImportQuery(language)
  if (!queryString || !lang) return []

  const captures = runQuery(lang, queryString, tree.rootNode)
  const imports: ImportInfo[] = []

  for (const capture of captures) {
    if (!capture.name.endsWith('.source') && !capture.name.endsWith('.method')) continue
    if (!capture.name.endsWith('.source')) continue

    const source = capture.node.text.replace(/^['"]|['"]$/g, '')
    const prefix = capture.name.split('.')[0]

    let kind: ImportInfo['kind'] = 'import'
    let isRelative = source.startsWith('.')

    if (prefix === 'import') {
      const methodCapture = captures.find(
        (c) => c.name === 'import.method' && Math.abs(c.node.startPosition.row - capture.node.startPosition.row) <= 1,
      )
      const method = methodCapture?.node.text
      if (method === 'require') { kind = 'require'; isRelative = false }
      else if (method === 'require_relative') { kind = 'require_relative'; isRelative = true }
      else if (method === 'include') { kind = 'include' }
      else if (method === 'extend') { kind = 'extend' }
    } else if (prefix === 'reexport') {
      kind = 're_export'
    } else if (prefix === 'dynamic_import') {
      kind = 'dynamic_import'
    }

    imports.push({
      source,
      importedNames: kind === 'include' || kind === 'extend' ? [source] : [],
      isRelative,
      filePath,
      line: capture.node.startPosition.row + 1,
      kind,
    })
  }

  return imports
}

export async function extractCallSites(
  tree: Tree,
  language: string,
  filePath: string,
  lang?: Language,
): Promise<CallSiteInfo[]> {
  const queryString = getCallQuery(language)
  if (!queryString || !lang) return []

  const captures = runQuery(lang, queryString, tree.rootNode)
  const calls: CallSiteInfo[] = []

  for (const capture of captures) {
    if (capture.name === 'call.function' || capture.name === 'call.method') {
      const receiverCapture = captures.find(
        (c) => c.name === 'call.receiver' && c.node.startPosition.row === capture.node.startPosition.row,
      )
      const receiver = receiverCapture?.node.text ?? null
      const calleeName = receiver ? `${receiver}.${capture.node.text}` : capture.node.text

      calls.push({
        calleeName,
        receiver,
        containingScope: buildParentScope(capture.node),
        filePath,
        line: capture.node.startPosition.row + 1,
      })
    }
  }

  return calls
}

export async function extractInheritance(
  tree: Tree,
  language: string,
  filePath: string,
  lang?: Language,
): Promise<InheritanceInfo[]> {
  const queryString = getInheritanceQuery(language)
  if (!queryString || !lang) return []

  const captures = runQuery(lang, queryString, tree.rootNode)
  const results: InheritanceInfo[] = []

  for (const capture of captures) {
    if (capture.name === 'extends.parent' || capture.name === 'parent.name') {
      const childCapture = captures.find(
        (c) => c.name === 'child.name' && Math.abs(c.node.startPosition.row - capture.node.startPosition.row) <= 2,
      )
      if (!childCapture) continue

      results.push({
        childName: childCapture.node.text,
        parentName: capture.node.text,
        kind: 'extends',
        filePath,
        line: capture.node.startPosition.row + 1,
      })
    }

    if (capture.name === 'implements.parent') {
      const childCapture = captures.find(
        (c) => c.name === 'child.name' && Math.abs(c.node.startPosition.row - capture.node.startPosition.row) <= 2,
      )
      if (!childCapture) continue

      results.push({
        childName: childCapture.node.text,
        parentName: capture.node.text,
        kind: 'implements',
        filePath,
        line: capture.node.startPosition.row + 1,
      })
    }
  }

  return results
}
