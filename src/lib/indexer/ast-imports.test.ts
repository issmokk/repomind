// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { extractImports, extractCallSites, extractInheritance } from './ast-imports'

function makeNode(
  type: string, text: string, children: ReturnType<typeof makeNode>[] = [],
  startRow = 0, parent: ReturnType<typeof makeNode> | null = null,
): ReturnType<typeof makeNode> {
  const node: Record<string, unknown> = { type, text, startPosition: { row: startRow }, children, childCount: children.length, parent }
  children.forEach((c) => { (c as Record<string, unknown>).parent = node })
  return node as never
}
function makeTree(rootNode: ReturnType<typeof makeNode>) { return { rootNode } as never }

describe('extractImports', () => {
  describe('Ruby', () => {
    it('extracts require statements', () => {
      const argNode = makeNode('string', "'foo'")
      const methodNode = makeNode('identifier', 'require')
      const callNode = makeNode('call', "require 'foo'", [methodNode, argNode])
      const tree = makeTree(makeNode('program', '', [callNode]))
      const result = extractImports(tree, 'ruby', 'app.rb')
      expect(result).toHaveLength(1)
      expect(result[0].source).toBe('foo')
      expect(result[0].kind).toBe('require')
      expect(result[0].isRelative).toBe(false)
    })

    it('extracts require_relative statements', () => {
      const argNode = makeNode('string', "'./helpers/auth'")
      const methodNode = makeNode('identifier', 'require_relative')
      const callNode = makeNode('call', "require_relative './helpers/auth'", [methodNode, argNode])
      const tree = makeTree(makeNode('program', '', [callNode]))
      const result = extractImports(tree, 'ruby', 'app.rb')
      expect(result[0].isRelative).toBe(true)
      expect(result[0].kind).toBe('require_relative')
    })

    it('extracts include module references', () => {
      const argNode = makeNode('constant', 'Injectable')
      const methodNode = makeNode('identifier', 'include')
      const callNode = makeNode('call', 'include Injectable', [methodNode, argNode])
      const tree = makeTree(makeNode('program', '', [callNode]))
      const result = extractImports(tree, 'ruby', 'app.rb')
      expect(result[0].kind).toBe('include')
      expect(result[0].importedNames).toEqual(['Injectable'])
    })
  })

  describe('TypeScript', () => {
    it('extracts import declarations', () => {
      const fooId = makeNode('identifier', 'foo')
      const importClause = makeNode('import_clause', '{ foo }', [fooId])
      const sourceNode = makeNode('string', "'./bar'")
      const importNode = makeNode('import_statement', "import { foo } from './bar'", [importClause, sourceNode])
      const tree = makeTree(makeNode('program', '', [importNode]))
      const result = extractImports(tree, 'typescript', 'app.ts')
      expect(result[0].source).toBe('./bar')
      expect(result[0].importedNames).toContain('foo')
      expect(result[0].isRelative).toBe(true)
    })

    it('identifies external package imports', () => {
      const sourceNode = makeNode('string', "'lodash'")
      const importNode = makeNode('import_statement', "import lodash from 'lodash'", [sourceNode])
      const tree = makeTree(makeNode('program', '', [importNode]))
      const result = extractImports(tree, 'typescript', 'app.ts')
      expect(result[0].source).toBe('lodash')
      expect(result[0].isRelative).toBe(false)
    })
  })
})

describe('extractCallSites', () => {
  describe('Ruby', () => {
    it('extracts method calls with receiver', () => {
      const receiverNode = makeNode('identifier', 'payment')
      const dotNode = makeNode('.', '.')
      const methodNode = makeNode('identifier', 'process')
      const callNode = makeNode('call', 'payment.process', [receiverNode, dotNode, methodNode])
      const tree = makeTree(makeNode('program', '', [callNode]))
      const result = extractCallSites(tree, 'ruby', 'app.rb')
      expect(result[0].calleeName).toBe('payment.process')
      expect(result[0].receiver).toBe('payment')
    })

    it('extracts standalone function calls', () => {
      const methodNode = makeNode('identifier', 'validate')
      const callNode = makeNode('call', 'validate', [methodNode])
      const tree = makeTree(makeNode('program', '', [callNode]))
      const result = extractCallSites(tree, 'ruby', 'app.rb')
      expect(result[0].calleeName).toBe('validate')
      expect(result[0].receiver).toBeNull()
    })
  })

  describe('TypeScript', () => {
    it('extracts function calls', () => {
      const funcNode = makeNode('identifier', 'fetchData')
      const callNode = makeNode('call_expression', 'fetchData()', [funcNode])
      const tree = makeTree(makeNode('program', '', [callNode]))
      const result = extractCallSites(tree, 'typescript', 'app.ts')
      expect(result[0].calleeName).toBe('fetchData')
      expect(result[0].receiver).toBeNull()
    })

    it('extracts method calls on objects', () => {
      const objNode = makeNode('identifier', 'api')
      const propNode = makeNode('property_identifier', 'get')
      const memberNode = makeNode('member_expression', 'api.get', [objNode, propNode])
      const callNode = makeNode('call_expression', 'api.get()', [memberNode])
      const tree = makeTree(makeNode('program', '', [callNode]))
      const result = extractCallSites(tree, 'typescript', 'app.ts')
      expect(result[0].calleeName).toBe('api.get')
      expect(result[0].receiver).toBe('api')
    })
  })
})

describe('extractInheritance', () => {
  describe('Ruby', () => {
    it('extracts class inheritance', () => {
      const nameNode = makeNode('constant', 'Admin')
      const parentConst = makeNode('constant', 'User')
      const superNode = makeNode('superclass', '< User', [parentConst])
      const classNode = makeNode('class', 'class Admin < User', [nameNode, superNode])
      const tree = makeTree(makeNode('program', '', [classNode]))
      const result = extractInheritance(tree, 'ruby', 'admin.rb')
      expect(result[0].childName).toBe('Admin')
      expect(result[0].parentName).toBe('User')
      expect(result[0].kind).toBe('extends')
    })
  })

  describe('TypeScript', () => {
    it('extracts class extends', () => {
      const nameNode = makeNode('identifier', 'Admin')
      const parentNode = makeNode('identifier', 'User')
      const extendsClause = makeNode('extends_clause', 'extends User', [parentNode])
      const heritage = makeNode('class_heritage', 'extends User', [extendsClause])
      const classNode = makeNode('class_declaration', 'class Admin extends User', [nameNode, heritage])
      const tree = makeTree(makeNode('program', '', [classNode]))
      const result = extractInheritance(tree, 'typescript', 'admin.ts')
      expect(result[0].childName).toBe('Admin')
      expect(result[0].parentName).toBe('User')
      expect(result[0].kind).toBe('extends')
    })

    it('extracts class implements', () => {
      const nameNode = makeNode('identifier', 'OllamaProvider')
      const ifaceNode = makeNode('type_identifier', 'EmbeddingProvider')
      const implClause = makeNode('implements_clause', 'implements EmbeddingProvider', [ifaceNode])
      const heritage = makeNode('class_heritage', '', [implClause])
      const classNode = makeNode('class_declaration', 'class OllamaProvider', [nameNode, heritage])
      const tree = makeTree(makeNode('program', '', [classNode]))
      const result = extractInheritance(tree, 'typescript', 'ollama.ts')
      expect(result[0].kind).toBe('implements')
      expect(result[0].parentName).toBe('EmbeddingProvider')
    })
  })
})
