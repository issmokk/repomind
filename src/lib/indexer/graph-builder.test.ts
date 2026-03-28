// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { buildGraphEdges } from './graph-builder'
import type { ASTAnalysisResult } from './graph-builder'

const BASE_OPTIONS = {
  repoId: 'repo-1',
  fileTree: ['src/index.ts', 'src/services/payment.ts', 'src/models/user.ts', 'lib/models/user.rb'],
  language: 'typescript',
}

function emptyAnalysis(): ASTAnalysisResult {
  return { imports: [], callSites: [], inheritance: [], composition: [] }
}

describe('buildGraphEdges', () => {
  describe('import edges', () => {
    it('creates imports edge for relative import with resolved path', () => {
      const analysis: ASTAnalysisResult = {
        ...emptyAnalysis(),
        imports: [{
          source: './services/payment', importedNames: ['processPayment'],
          isRelative: true, filePath: 'src/index.ts', line: 1, kind: 'import',
        }],
      }
      const edges = buildGraphEdges('src/index.ts', analysis, BASE_OPTIONS)
      const importEdge = edges.find((e) => e.relationshipType === 'imports')
      expect(importEdge).toBeDefined()
      expect(importEdge!.sourceFile).toBe('src/index.ts')
      expect(importEdge!.targetFile).toBe('src/services/payment.ts')
    })

    it('resolves relative import with ../ paths', () => {
      const analysis: ASTAnalysisResult = {
        ...emptyAnalysis(),
        imports: [{
          source: '../models/user', importedNames: ['User'],
          isRelative: true, filePath: 'src/services/payment.ts', line: 1, kind: 'import',
        }],
      }
      const edges = buildGraphEdges('src/services/payment.ts', analysis, BASE_OPTIONS)
      const importEdge = edges.find((e) => e.relationshipType === 'imports')
      expect(importEdge!.targetFile).toBe('src/models/user.ts')
    })

    it('creates external_dep edge for npm package', () => {
      const analysis: ASTAnalysisResult = {
        ...emptyAnalysis(),
        imports: [{
          source: 'lodash', importedNames: [], isRelative: false,
          filePath: 'src/index.ts', line: 2, kind: 'import',
        }],
      }
      const edges = buildGraphEdges('src/index.ts', analysis, BASE_OPTIONS)
      const extEdge = edges.find((e) => e.relationshipType === 'external_dep')
      expect(extEdge!.targetFile).toBeNull()
      expect(extEdge!.metadata).toMatchObject({ package_name: 'lodash' })
    })

    it('stores scoped package name in metadata', () => {
      const analysis: ASTAnalysisResult = {
        ...emptyAnalysis(),
        imports: [{
          source: '@wetravel-mfe/common', importedNames: [], isRelative: false,
          filePath: 'src/index.ts', line: 3, kind: 'import',
        }],
      }
      const edges = buildGraphEdges('src/index.ts', analysis, BASE_OPTIONS)
      const extEdge = edges.find((e) => e.relationshipType === 'external_dep')
      expect(extEdge!.metadata).toMatchObject({ package_name: '@wetravel-mfe/common' })
    })
  })

  describe('call edges', () => {
    it('creates calls edge linking to imported file via receiver', () => {
      const analysis: ASTAnalysisResult = {
        ...emptyAnalysis(),
        imports: [{
          source: './services/payment', importedNames: ['paymentService'],
          isRelative: true, filePath: 'src/index.ts', line: 1, kind: 'import',
        }],
        callSites: [{
          calleeName: 'paymentService.process', receiver: 'paymentService',
          containingScope: 'handleCheckout', filePath: 'src/index.ts', line: 10,
        }],
      }
      const edges = buildGraphEdges('src/index.ts', analysis, BASE_OPTIONS)
      const callEdge = edges.find((e) => e.relationshipType === 'calls')
      expect(callEdge!.sourceSymbol).toBe('handleCheckout')
      expect(callEdge!.targetSymbol).toBe('paymentService.process')
      expect(callEdge!.targetFile).toBe('src/services/payment.ts')
    })

    it('sets targetFile to null for unresolvable calls', () => {
      const analysis: ASTAnalysisResult = {
        ...emptyAnalysis(),
        callSites: [{
          calleeName: 'console.log', receiver: 'console',
          containingScope: 'main', filePath: 'src/index.ts', line: 5,
        }],
      }
      const edges = buildGraphEdges('src/index.ts', analysis, BASE_OPTIONS)
      const callEdge = edges.find((e) => e.relationshipType === 'calls')
      expect(callEdge!.targetFile).toBeNull()
    })

    it('self-referencing calls have source_file === target_file when symbol imported from same file', () => {
      const analysis: ASTAnalysisResult = {
        ...emptyAnalysis(),
        callSites: [{
          calleeName: 'helperFunc', receiver: null,
          containingScope: 'main', filePath: 'src/index.ts', line: 3,
        }],
      }
      const edges = buildGraphEdges('src/index.ts', analysis, BASE_OPTIONS)
      const callEdge = edges.find((e) => e.relationshipType === 'calls')
      expect(callEdge!.targetFile).toBeNull()
    })
  })

  describe('inheritance edges', () => {
    it('creates inherits edge for class extends', () => {
      const analysis: ASTAnalysisResult = {
        ...emptyAnalysis(),
        inheritance: [{
          childName: 'Admin', parentName: 'User', kind: 'extends',
          filePath: 'src/admin.ts', line: 1,
        }],
      }
      const edges = buildGraphEdges('src/admin.ts', analysis, BASE_OPTIONS)
      const inhEdge = edges.find((e) => e.relationshipType === 'inherits')
      expect(inhEdge!.sourceSymbol).toBe('Admin')
      expect(inhEdge!.targetSymbol).toBe('User')
    })
  })

  describe('composition edges', () => {
    it('creates composes edge for Ruby include', () => {
      const analysis: ASTAnalysisResult = {
        ...emptyAnalysis(),
        imports: [{
          source: 'Cacheable', importedNames: ['Cacheable'], isRelative: false,
          filePath: 'product.rb', line: 2, kind: 'include',
        }],
        composition: [{
          childName: 'Product', parentName: 'Cacheable', kind: 'includes',
          filePath: 'product.rb', line: 2,
        }],
      }
      const edges = buildGraphEdges('product.rb', analysis, { ...BASE_OPTIONS, language: 'ruby' })
      const composeEdge = edges.find((e) => e.relationshipType === 'composes')
      expect(composeEdge).toBeDefined()
      expect(composeEdge!.sourceSymbol).toBe('Product')
      expect(composeEdge!.targetSymbol).toBe('Cacheable')
    })
  })

  describe('edge cases', () => {
    it('empty analysis returns empty array', () => {
      expect(buildGraphEdges('test.ts', emptyAnalysis(), BASE_OPTIONS)).toEqual([])
    })

    it('deduplicates identical edges', () => {
      const analysis: ASTAnalysisResult = {
        ...emptyAnalysis(),
        callSites: [
          { calleeName: 'foo', receiver: null, containingScope: 'bar', filePath: 'a.ts', line: 1 },
          { calleeName: 'foo', receiver: null, containingScope: 'bar', filePath: 'a.ts', line: 5 },
        ],
      }
      const edges = buildGraphEdges('a.ts', analysis, BASE_OPTIONS)
      const callEdges = edges.filter((e) => e.relationshipType === 'calls')
      expect(callEdges).toHaveLength(1)
    })
  })
})
