// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { extractSymbols, extractImports, extractCallSites, extractInheritance, detectLanguage } from './ast-analyzer'

function makeNode(
  type: string, text: string, children: ReturnType<typeof makeNode>[] = [],
  startRow = 0, endRow = 0, parent: ReturnType<typeof makeNode> | null = null,
): ReturnType<typeof makeNode> {
  const node: Record<string, unknown> = {
    type, text, startPosition: { row: startRow, column: 0 },
    endPosition: { row: endRow, column: 0 }, children, childCount: children.length, parent,
  }
  children.forEach((c) => { (c as Record<string, unknown>).parent = node })
  return node as never
}

function makeTree(rootNode: ReturnType<typeof makeNode>) { return { rootNode } as never }

function mockLanguage(captureResults: Array<{ name: string; node: ReturnType<typeof makeNode> }>) {
  return {
    query: () => ({
      captures: () => captureResults,
    }),
  } as never
}

describe('extractSymbols', () => {
  describe('Ruby', () => {
    it('extracts class definitions', async () => {
      const nameNode = makeNode('constant', 'PaymentService', [], 0, 0)
      const classNode = makeNode('class', 'class PaymentService\nend', [nameNode], 0, 19)
      ;(nameNode as Record<string, unknown>).parent = classNode

      const lang = mockLanguage([
        { name: 'class.name', node: nameNode },
        { name: 'class.definition', node: classNode },
      ])

      const result = await extractSymbols(makeTree(makeNode('program', '', [classNode])), 'ruby', 'payment_service.rb', lang)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('class')
      expect(result[0].name).toBe('PaymentService')
      expect(result[0].startLine).toBe(1)
    })

    it('extracts module definitions', async () => {
      const nameNode = makeNode('scope_resolution', 'WT::Payment', [], 0, 0)
      const moduleNode = makeNode('module', 'module WT::Payment', [nameNode], 0, 5)
      ;(nameNode as Record<string, unknown>).parent = moduleNode

      const lang = mockLanguage([
        { name: 'module.name', node: nameNode },
        { name: 'module.definition', node: moduleNode },
      ])

      const result = await extractSymbols(makeTree(makeNode('program', '', [moduleNode])), 'ruby', 'payment.rb', lang)
      expect(result[0].type).toBe('module')
      expect(result[0].name).toBe('WT::Payment')
    })

    it('extracts method with parent class scope', async () => {
      const className = makeNode('constant', 'Foo', [], 0, 0)
      const classNode = makeNode('class', 'class Foo', [className], 0, 5)
      const methodName = makeNode('identifier', 'bar', [], 2, 2)
      const methodNode = makeNode('method', 'def bar; end', [methodName], 2, 4)
      ;(methodName as Record<string, unknown>).parent = methodNode
      ;(methodNode as Record<string, unknown>).parent = classNode

      const lang = mockLanguage([
        { name: 'class.name', node: className },
        { name: 'class.definition', node: classNode },
        { name: 'method.name', node: methodName },
        { name: 'method.definition', node: methodNode },
      ])

      const result = await extractSymbols(makeTree(makeNode('program', '', [classNode])), 'ruby', 'foo.rb', lang)
      const method = result.find((s) => s.type === 'method')
      expect(method).toBeDefined()
      expect(method!.parentScope).toBe('Foo')
    })

    it('extracts singleton methods', async () => {
      const nameNode = makeNode('identifier', 'create', [], 1, 1)
      const singletonNode = makeNode('singleton_method', 'def self.create; end', [nameNode], 1, 3)
      ;(nameNode as Record<string, unknown>).parent = singletonNode

      const lang = mockLanguage([
        { name: 'singleton_method.name', node: nameNode },
        { name: 'singleton_method.definition', node: singletonNode },
      ])

      const result = await extractSymbols(makeTree(makeNode('program', '', [singletonNode])), 'ruby', 'factory.rb', lang)
      expect(result[0].name).toBe('create')
      expect(result[0].type).toBe('method')
    })
  })

  describe('TypeScript', () => {
    it('extracts function declarations', async () => {
      const nameNode = makeNode('identifier', 'processPayment', [], 4, 4)
      const funcNode = makeNode('function_declaration', 'function processPayment() {}', [nameNode], 4, 24)
      ;(nameNode as Record<string, unknown>).parent = funcNode

      const lang = mockLanguage([
        { name: 'function.name', node: nameNode },
        { name: 'function.definition', node: funcNode },
      ])

      const result = await extractSymbols(makeTree(makeNode('program', '', [funcNode])), 'typescript', 'payment.ts', lang)
      expect(result[0].type).toBe('function')
      expect(result[0].name).toBe('processPayment')
      expect(result[0].startLine).toBe(5)
    })

    it('extracts arrow function assignments', async () => {
      const nameNode = makeNode('identifier', 'handler', [], 0, 0)
      const arrowDef = makeNode('lexical_declaration', 'const handler = () => {}', [nameNode], 0, 2)
      ;(nameNode as Record<string, unknown>).parent = arrowDef

      const lang = mockLanguage([
        { name: 'arrow.name', node: nameNode },
        { name: 'arrow.definition', node: arrowDef },
      ])

      const result = await extractSymbols(makeTree(makeNode('program', '', [arrowDef])), 'typescript', 'handler.ts', lang)
      expect(result[0].type).toBe('function')
      expect(result[0].name).toBe('handler')
    })

    it('extracts interface declarations', async () => {
      const nameNode = makeNode('type_identifier', 'PaymentProvider', [], 0, 0)
      const ifaceNode = makeNode('interface_declaration', 'interface PaymentProvider {}', [nameNode], 0, 3)
      ;(nameNode as Record<string, unknown>).parent = ifaceNode

      const lang = mockLanguage([
        { name: 'interface.name', node: nameNode },
        { name: 'interface.definition', node: ifaceNode },
      ])

      const result = await extractSymbols(makeTree(makeNode('program', '', [ifaceNode])), 'typescript', 'types.ts', lang)
      expect(result[0].type).toBe('interface')
    })

    it('extracts type alias declarations', async () => {
      const nameNode = makeNode('type_identifier', 'PaymentStatus', [], 0, 0)
      const typeNode = makeNode('type_alias_declaration', "type PaymentStatus = 'ok'", [nameNode], 0, 0)
      ;(nameNode as Record<string, unknown>).parent = typeNode

      const lang = mockLanguage([
        { name: 'type_alias.name', node: nameNode },
        { name: 'type_alias.definition', node: typeNode },
      ])

      const result = await extractSymbols(makeTree(makeNode('program', '', [typeNode])), 'typescript', 'types.ts', lang)
      expect(result[0].type).toBe('type_alias')
    })
  })

  describe('General', () => {
    it('returns empty array for unsupported language', async () => {
      const result = await extractSymbols(makeTree(makeNode('document', '')), 'html', 'index.html')
      expect(result).toEqual([])
    })

    it('returns empty array when no language object provided', async () => {
      const result = await extractSymbols(makeTree(makeNode('program', '')), 'ruby', 'test.rb')
      expect(result).toEqual([])
    })
  })
})

describe('extractImports', () => {
  it('extracts Ruby require', async () => {
    const methodNode = makeNode('identifier', 'require', [], 0, 0)
    const sourceNode = makeNode('string_content', 'foo', [], 0, 0)

    const lang = mockLanguage([
      { name: 'import.method', node: methodNode },
      { name: 'import.source', node: sourceNode },
    ])

    const result = await extractImports(makeTree(makeNode('program', '')), 'ruby', 'app.rb', lang)
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('foo')
    expect(result[0].kind).toBe('require')
  })

  it('extracts TS import statement', async () => {
    const sourceNode = makeNode('string_fragment', './bar', [], 0, 0)

    const lang = mockLanguage([
      { name: 'import.source', node: sourceNode },
    ])

    const result = await extractImports(makeTree(makeNode('program', '')), 'typescript', 'app.ts', lang)
    expect(result[0].source).toBe('./bar')
    expect(result[0].isRelative).toBe(true)
    expect(result[0].kind).toBe('import')
  })

  it('returns empty for unsupported language', async () => {
    const result = await extractImports(makeTree(makeNode('program', '')), 'html', 'index.html')
    expect(result).toEqual([])
  })
})

describe('extractCallSites', () => {
  it('extracts standalone function call', async () => {
    const funcNode = makeNode('identifier', 'fetchData', [], 5, 5)
    ;(funcNode as Record<string, unknown>).parent = makeNode('program', '')

    const lang = mockLanguage([
      { name: 'call.function', node: funcNode },
    ])

    const result = await extractCallSites(makeTree(makeNode('program', '')), 'typescript', 'app.ts', lang)
    expect(result[0].calleeName).toBe('fetchData')
    expect(result[0].receiver).toBeNull()
  })

  it('extracts method call with receiver', async () => {
    const receiverNode = makeNode('identifier', 'api', [], 3, 3)
    const methodNode = makeNode('property_identifier', 'get', [], 3, 3)
    ;(methodNode as Record<string, unknown>).parent = makeNode('program', '')

    const lang = mockLanguage([
      { name: 'call.receiver', node: receiverNode },
      { name: 'call.method', node: methodNode },
    ])

    const result = await extractCallSites(makeTree(makeNode('program', '')), 'typescript', 'app.ts', lang)
    expect(result[0].calleeName).toBe('api.get')
    expect(result[0].receiver).toBe('api')
  })
})

describe('extractInheritance', () => {
  it('extracts class extends', async () => {
    const childNode = makeNode('identifier', 'Admin', [], 0, 0)
    const parentNode = makeNode('identifier', 'User', [], 0, 0)

    const lang = mockLanguage([
      { name: 'child.name', node: childNode },
      { name: 'extends.parent', node: parentNode },
    ])

    const result = await extractInheritance(makeTree(makeNode('program', '')), 'typescript', 'admin.ts', lang)
    expect(result[0].childName).toBe('Admin')
    expect(result[0].parentName).toBe('User')
    expect(result[0].kind).toBe('extends')
  })

  it('extracts class implements', async () => {
    const childNode = makeNode('identifier', 'OllamaProvider', [], 0, 0)
    const ifaceNode = makeNode('type_identifier', 'EmbeddingProvider', [], 0, 0)

    const lang = mockLanguage([
      { name: 'child.name', node: childNode },
      { name: 'implements.parent', node: ifaceNode },
    ])

    const result = await extractInheritance(makeTree(makeNode('program', '')), 'typescript', 'ollama.ts', lang)
    expect(result[0].kind).toBe('implements')
    expect(result[0].parentName).toBe('EmbeddingProvider')
  })
})

describe('detectLanguage', () => {
  it('detects typescript from .ts', () => expect(detectLanguage('src/index.ts')).toBe('typescript'))
  it('detects ruby from .rb', () => expect(detectLanguage('app/models/user.rb')).toBe('ruby'))
  it('returns null for unknown', () => expect(detectLanguage('file.xyz')).toBeNull())
})
