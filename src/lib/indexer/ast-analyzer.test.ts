// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { extractSymbols, detectLanguage } from './ast-analyzer'

function makeNode(
  type: string,
  text: string,
  children: ReturnType<typeof makeNode>[] = [],
  startRow = 0,
  endRow = 0,
  parent: ReturnType<typeof makeNode> | null = null,
): ReturnType<typeof makeNode> & { parent: ReturnType<typeof makeNode> | null } {
  const node: Record<string, unknown> = {
    type,
    text,
    startPosition: { row: startRow, column: 0 },
    endPosition: { row: endRow, column: 0 },
    children,
    childCount: children.length,
    parent,
  }
  children.forEach((c) => { (c as Record<string, unknown>).parent = node })
  return node as never
}

function makeTree(rootNode: ReturnType<typeof makeNode>) {
  return { rootNode } as never
}

describe('extractSymbols', () => {
  describe('Ruby', () => {
    it('extracts class definitions', () => {
      const nameNode = makeNode('constant', 'PaymentService')
      const classNode = makeNode('class', 'class PaymentService\nend', [nameNode], 0, 19)
      const tree = makeTree(makeNode('program', '', [classNode]))

      const result = extractSymbols(tree, 'ruby', 'payment_service.rb')
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('class')
      expect(result[0].name).toBe('PaymentService')
      expect(result[0].startLine).toBe(1)
      expect(result[0].endLine).toBe(20)
    })

    it('extracts module definitions', () => {
      const nameNode = makeNode('scope_resolution', 'WT::Payment')
      const moduleNode = makeNode('module', 'module WT::Payment', [nameNode], 0, 5)
      const tree = makeTree(makeNode('program', '', [moduleNode]))

      const result = extractSymbols(tree, 'ruby', 'payment.rb')
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('module')
      expect(result[0].name).toBe('WT::Payment')
    })

    it('extracts method definitions with parent class scope', () => {
      const methodName = makeNode('identifier', 'bar')
      const methodNode = makeNode('method', 'def bar; end', [methodName], 2, 4)
      const className = makeNode('constant', 'Foo')
      const classNode = makeNode('class', 'class Foo', [className, methodNode], 0, 5)
      const tree = makeTree(makeNode('program', '', [classNode]))

      const result = extractSymbols(tree, 'ruby', 'foo.rb')
      const method = result.find((s) => s.type === 'method')
      expect(method).toBeDefined()
      expect(method!.name).toBe('bar')
      expect(method!.parentScope).toBe('Foo')
    })

    it('extracts singleton methods', () => {
      const nameNode = makeNode('identifier', 'create')
      const singletonNode = makeNode('singleton_method', 'def self.create; end', [nameNode], 1, 3)
      const tree = makeTree(makeNode('program', '', [singletonNode]))

      const result = extractSymbols(tree, 'ruby', 'factory.rb')
      expect(result.some((s) => s.name === 'self.create')).toBe(true)
    })

    it('handles nested classes/modules', () => {
      const methodName = makeNode('identifier', 'call')
      const methodNode = makeNode('method', 'def call; end', [methodName], 4, 6)
      const actionName = makeNode('constant', 'Action')
      const actionClass = makeNode('class', 'class Action', [actionName, methodNode], 3, 7)
      const paymentName = makeNode('constant', 'Payment')
      const paymentModule = makeNode('module', 'module Payment', [paymentName, actionClass], 1, 8)
      const wtName = makeNode('constant', 'WT')
      const wtModule = makeNode('module', 'module WT', [wtName, paymentModule], 0, 9)
      const tree = makeTree(makeNode('program', '', [wtModule]))

      const result = extractSymbols(tree, 'ruby', 'action.rb')
      const method = result.find((s) => s.type === 'method' && s.name === 'call')
      expect(method).toBeDefined()
      expect(method!.parentScope).toBe('WT.Payment.Action')
    })
  })

  describe('TypeScript', () => {
    it('extracts function declarations', () => {
      const nameNode = makeNode('identifier', 'processPayment')
      const funcNode = makeNode('function_declaration', 'function processPayment() {}', [nameNode], 4, 24)
      const tree = makeTree(makeNode('program', '', [funcNode]))

      const result = extractSymbols(tree, 'typescript', 'payment.ts')
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('function')
      expect(result[0].name).toBe('processPayment')
      expect(result[0].startLine).toBe(5)
    })

    it('extracts arrow function assignments', () => {
      const nameNode = makeNode('identifier', 'handler')
      const arrowNode = makeNode('arrow_function', '() => {}')
      const declarator = makeNode('variable_declarator', 'handler = () => {}', [nameNode, arrowNode])
      const lexical = makeNode('lexical_declaration', 'const handler = () => {}', [declarator], 0, 2)
      const tree = makeTree(makeNode('program', '', [lexical]))

      const result = extractSymbols(tree, 'typescript', 'handler.ts')
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('function')
      expect(result[0].name).toBe('handler')
    })

    it('extracts class declarations', () => {
      const nameNode = makeNode('identifier', 'PaymentController')
      const classNode = makeNode('class_declaration', 'class PaymentController {}', [nameNode], 0, 10)
      const tree = makeTree(makeNode('program', '', [classNode]))

      const result = extractSymbols(tree, 'typescript', 'ctrl.ts')
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('class')
      expect(result[0].name).toBe('PaymentController')
    })

    it('extracts method definitions within classes', () => {
      const methodName = makeNode('property_identifier', 'handleRequest')
      const methodNode = makeNode('method_definition', 'handleRequest() {}', [methodName], 2, 5)
      const className = makeNode('identifier', 'Ctrl')
      const classNode = makeNode('class_declaration', 'class Ctrl', [className, methodNode], 0, 6)
      const tree = makeTree(makeNode('program', '', [classNode]))

      const result = extractSymbols(tree, 'typescript', 'ctrl.ts')
      const method = result.find((s) => s.type === 'method')
      expect(method).toBeDefined()
      expect(method!.parentScope).toBe('Ctrl')
    })

    it('extracts interface declarations', () => {
      const nameNode = makeNode('type_identifier', 'PaymentProvider')
      const ifaceNode = makeNode('interface_declaration', 'interface PaymentProvider {}', [nameNode], 0, 3)
      const tree = makeTree(makeNode('program', '', [ifaceNode]))

      const result = extractSymbols(tree, 'typescript', 'types.ts')
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('interface')
      expect(result[0].name).toBe('PaymentProvider')
    })

    it('extracts type alias declarations', () => {
      const nameNode = makeNode('type_identifier', 'PaymentStatus')
      const typeNode = makeNode('type_alias_declaration', "type PaymentStatus = 'ok'", [nameNode], 0, 0)
      const tree = makeTree(makeNode('program', '', [typeNode]))

      const result = extractSymbols(tree, 'typescript', 'types.ts')
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('type_alias')
      expect(result[0].name).toBe('PaymentStatus')
    })

    it('handles namespace nesting', () => {
      const funcName = makeNode('identifier', 'fetchData')
      const funcNode = makeNode('function_declaration', 'function fetchData() {}', [funcName], 2, 5)
      const nsName = makeNode('identifier', 'API')
      const nsNode = makeNode('module', 'namespace API', [nsName, funcNode], 0, 6)
      const tree = makeTree(makeNode('program', '', [nsNode]))

      const result = extractSymbols(tree, 'typescript', 'api.ts')
      const func = result.find((s) => s.type === 'function')
      expect(func).toBeDefined()
      expect(func!.parentScope).toBe('API')
    })
  })

  describe('General', () => {
    it('returns empty array for unsupported language', () => {
      const tree = makeTree(makeNode('document', ''))
      const result = extractSymbols(tree, 'html', 'index.html')
      expect(result).toEqual([])
    })

    it('returns empty array for file with no symbols', () => {
      const commentNode = makeNode('comment', '# just a comment')
      const tree = makeTree(makeNode('program', '', [commentNode]))
      const result = extractSymbols(tree, 'ruby', 'empty.rb')
      expect(result).toEqual([])
    })

    it('each symbol includes all required fields', () => {
      const nameNode = makeNode('identifier', 'foo')
      const funcNode = makeNode('function_declaration', 'function foo() {}', [nameNode], 0, 2)
      const tree = makeTree(makeNode('program', '', [funcNode]))

      const [symbol] = extractSymbols(tree, 'typescript', 'test.ts')
      expect(symbol).toHaveProperty('type')
      expect(symbol).toHaveProperty('name')
      expect(symbol).toHaveProperty('filePath')
      expect(symbol).toHaveProperty('startLine')
      expect(symbol).toHaveProperty('endLine')
      expect(symbol).toHaveProperty('parentScope')
      expect(symbol).toHaveProperty('rawText')
    })
  })
})

describe('detectLanguage', () => {
  it('detects typescript from .ts extension', () => {
    expect(detectLanguage('src/index.ts')).toBe('typescript')
  })

  it('detects ruby from .rb extension', () => {
    expect(detectLanguage('app/models/user.rb')).toBe('ruby')
  })

  it('returns null for unknown extensions', () => {
    expect(detectLanguage('file.xyz')).toBeNull()
  })
})
