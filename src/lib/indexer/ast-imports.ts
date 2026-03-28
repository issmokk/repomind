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

interface TreeNode {
  type: string
  text: string
  startPosition: { row: number }
  parent: TreeNode | null
  children: TreeNode[]
  childCount: number
}

interface Tree {
  rootNode: TreeNode
}

const RUBY_IMPORT_METHODS = new Set(['require', 'require_relative', 'include', 'extend'])
const TS_IMPORT_TYPES = new Set(['import_statement', 'export_statement'])

function walkTree(node: TreeNode, visitor: (n: TreeNode) => void): void {
  visitor(node)
  for (let i = 0; i < node.childCount; i++) {
    walkTree(node.children[i], visitor)
  }
}

function findParentScope(node: TreeNode): string {
  const scopes: string[] = []
  let current = node.parent
  while (current) {
    if (['class', 'module', 'class_declaration', 'method', 'method_definition', 'function_declaration'].includes(current.type)) {
      const nameChild = current.children.find(
        (c) => c.type === 'constant' || c.type === 'identifier' || c.type === 'type_identifier' || c.type === 'property_identifier',
      )
      if (nameChild) scopes.unshift(nameChild.text)
    }
    current = current.parent
  }
  return scopes.join('.')
}

export function extractImports(tree: Tree, language: string, filePath: string): ImportInfo[] {
  const imports: ImportInfo[] = []

  if (language === 'ruby') {
    walkTree(tree.rootNode, (node) => {
      if (node.type !== 'call' && node.type !== 'method_call') return
      const methodNode = node.children.find((c) => c.type === 'identifier')
      if (!methodNode || !RUBY_IMPORT_METHODS.has(methodNode.text)) return

      const argNode = node.children.find((c) => c.type === 'argument_list' || c.type === 'string' || c.type === 'constant' || c.type === 'scope_resolution')
      if (!argNode) return

      const source = argNode.text.replace(/^['"]|['"]$/g, '')
      const method = methodNode.text as 'require' | 'require_relative' | 'include' | 'extend'

      imports.push({
        source,
        importedNames: method === 'include' || method === 'extend' ? [source] : [],
        isRelative: method === 'require_relative',
        filePath,
        line: node.startPosition.row + 1,
        kind: method,
      })
    })
  }

  if (language === 'typescript' || language === 'javascript') {
    walkTree(tree.rootNode, (node) => {
      if (node.type === 'import_statement') {
        const sourceNode = node.children.find((c) => c.type === 'string')
        if (!sourceNode) return
        const source = sourceNode.text.replace(/^['"]|['"]$/g, '')
        const names: string[] = []
        const importClause = node.children.find((c) => c.type === 'import_clause')
        if (importClause) {
          walkTree(importClause, (n) => {
            if (n.type === 'identifier') names.push(n.text)
          })
        }
        imports.push({
          source,
          importedNames: names,
          isRelative: source.startsWith('.'),
          filePath,
          line: node.startPosition.row + 1,
          kind: 'import',
        })
      }

      if (node.type === 'export_statement') {
        const sourceNode = node.children.find((c) => c.type === 'string')
        if (!sourceNode) return
        const source = sourceNode.text.replace(/^['"]|['"]$/g, '')
        const names: string[] = []
        walkTree(node, (n) => {
          if (n.type === 'identifier' && n !== node) names.push(n.text)
        })
        imports.push({
          source,
          importedNames: names,
          isRelative: source.startsWith('.'),
          filePath,
          line: node.startPosition.row + 1,
          kind: 're_export',
        })
      }

      if (node.type === 'call_expression') {
        const funcNode = node.children[0]
        if (funcNode?.type === 'import') {
          const argNode = node.children.find((c) => c.type === 'arguments')
          const stringNode = argNode?.children.find((c) => c.type === 'string')
          if (stringNode) {
            const source = stringNode.text.replace(/^['"]|['"]$/g, '')
            imports.push({
              source,
              importedNames: [],
              isRelative: source.startsWith('.'),
              filePath,
              line: node.startPosition.row + 1,
              kind: 'dynamic_import',
            })
          }
        }
      }
    })
  }

  return imports
}

export function extractCallSites(tree: Tree, language: string, filePath: string): CallSiteInfo[] {
  const calls: CallSiteInfo[] = []

  if (language === 'ruby') {
    walkTree(tree.rootNode, (node) => {
      if (node.type !== 'call' && node.type !== 'method_call') return
      const identifiers = node.children.filter((c) => c.type === 'identifier')
      const dotIndex = node.children.findIndex((c) => c.type === '.')
      let methodNode: TreeNode | undefined
      let receiverNode: TreeNode | undefined

      if (dotIndex >= 0 && identifiers.length >= 2) {
        receiverNode = identifiers[0]
        methodNode = identifiers[1]
      } else {
        methodNode = identifiers[0]
      }

      if (!methodNode) return
      if (RUBY_IMPORT_METHODS.has(methodNode.text)) return

      const receiver = receiverNode?.text ?? null
      const calleeName = receiver ? `${receiver}.${methodNode.text}` : methodNode.text

      calls.push({
        calleeName,
        receiver,
        containingScope: findParentScope(node),
        filePath,
        line: node.startPosition.row + 1,
      })
    })
  }

  if (language === 'typescript' || language === 'javascript') {
    walkTree(tree.rootNode, (node) => {
      if (node.type !== 'call_expression') return
      const funcNode = node.children[0]
      if (!funcNode || funcNode.type === 'import') return

      let calleeName: string
      let receiver: string | null = null

      if (funcNode.type === 'member_expression') {
        const obj = funcNode.children[0]
        const prop = funcNode.children.find((c) => c.type === 'property_identifier')
        receiver = obj?.text ?? null
        calleeName = prop ? `${receiver}.${prop.text}` : funcNode.text
      } else {
        calleeName = funcNode.text
      }

      calls.push({
        calleeName,
        receiver,
        containingScope: findParentScope(node),
        filePath,
        line: node.startPosition.row + 1,
      })
    })
  }

  return calls
}

export function extractInheritance(tree: Tree, language: string, filePath: string): InheritanceInfo[] {
  const results: InheritanceInfo[] = []

  if (language === 'ruby') {
    walkTree(tree.rootNode, (node) => {
      if (node.type === 'class') {
        const nameNode = node.children.find((c) => c.type === 'constant' || c.type === 'scope_resolution')
        const superNode = node.children.find((c) => c.type === 'superclass')
        if (nameNode && superNode) {
          const parentName = superNode.children.find((c) => c.type === 'constant' || c.type === 'scope_resolution')
          if (parentName) {
            results.push({
              childName: nameNode.text,
              parentName: parentName.text,
              kind: 'extends',
              filePath,
              line: node.startPosition.row + 1,
            })
          }
        }
      }
    })
  }

  if (language === 'typescript' || language === 'javascript') {
    walkTree(tree.rootNode, (node) => {
      if (node.type !== 'class_declaration') return
      const nameNode = node.children.find((c) => c.type === 'identifier' || c.type === 'type_identifier')
      if (!nameNode) return

      const heritage = node.children.find((c) => c.type === 'class_heritage')
      if (!heritage) return

      walkTree(heritage, (h) => {
        if (h.type === 'extends_clause') {
          const parent = h.children.find((c) => c.type === 'identifier' || c.type === 'type_identifier')
          if (parent) {
            results.push({ childName: nameNode.text, parentName: parent.text, kind: 'extends', filePath, line: node.startPosition.row + 1 })
          }
        }
        if (h.type === 'implements_clause') {
          h.children.forEach((c) => {
            if (c.type === 'identifier' || c.type === 'type_identifier') {
              results.push({ childName: nameNode.text, parentName: c.text, kind: 'implements', filePath, line: node.startPosition.row + 1 })
            }
          })
        }
      })
    })
  }

  return results
}
