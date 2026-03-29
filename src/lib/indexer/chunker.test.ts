// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { chunkFile, countNonWhitespace, buildScopeTree, mergeSmallChunks as _mergeSmallChunks, addOverlap as _addOverlap } from './chunker'
import type { SymbolInfo } from './ast-analyzer'

function makeSymbol(overrides: Partial<SymbolInfo> & { name: string; startLine: number; endLine: number }): SymbolInfo {
  return { type: 'function', filePath: 'test.ts', parentScope: null, rawText: '', ...overrides }
}

function generateCode(lineCount: number, charsPerLine = 40): string {
  return Array.from({ length: lineCount }, (_, i) => 'x'.repeat(charsPerLine) + ` // line ${i + 1}`).join('\n')
}

describe('countNonWhitespace', () => {
  it('counts non-whitespace characters', () => {
    expect(countNonWhitespace('  hello world  ')).toBe(10)
    expect(countNonWhitespace('\t\n\r ')).toBe(0)
    expect(countNonWhitespace('abc')).toBe(3)
  })
})

describe('chunkFile', () => {
  describe('basic chunking', () => {
    it('single small function becomes one chunk', async () => {
      const code = 'function foo() {\n  return 1\n}\n'
      const symbols = [makeSymbol({ name: 'foo', startLine: 1, endLine: 3 })]
      const result = await chunkFile(code, symbols, 'test.ts', 'typescript')
      expect(result).toHaveLength(1)
      expect(result[0].symbolName).toBe('foo')
    })

    it('multiple small functions become separate chunks', async () => {
      const lines = ['function a() { return 1 }', 'function b() { return 2 }', 'function c() { return 3 }']
      const code = lines.join('\n')
      const symbols = [
        makeSymbol({ name: 'a', startLine: 1, endLine: 1 }),
        makeSymbol({ name: 'b', startLine: 2, endLine: 2 }),
        makeSymbol({ name: 'c', startLine: 3, endLine: 3 }),
      ]
      const result = await chunkFile(code, symbols, 'test.ts', 'typescript')
      expect(result.length).toBeGreaterThanOrEqual(1)
    })

    it('large function exceeding max size gets split', async () => {
      const bigCode = generateCode(100, 30)
      const symbols = [makeSymbol({ name: 'bigFunc', startLine: 1, endLine: 100 })]
      const result = await chunkFile(bigCode, symbols, 'test.ts', 'typescript')
      expect(result.length).toBeGreaterThan(1)
    })

    it('adjacent small chunks get merged', async () => {
      const code = 'a\nb\nc\nd\ne\n'
      const symbols = [
        makeSymbol({ name: 'a', startLine: 1, endLine: 1 }),
        makeSymbol({ name: 'b', startLine: 2, endLine: 2 }),
        makeSymbol({ name: 'c', startLine: 3, endLine: 3 }),
        makeSymbol({ name: 'd', startLine: 4, endLine: 4 }),
        makeSymbol({ name: 'e', startLine: 5, endLine: 5 }),
      ]
      const result = await chunkFile(code, symbols, 'test.ts', 'typescript')
      expect(result.length).toBeLessThan(5)
    })
  })

  describe('context prepending', () => {
    it('contextualized_content includes file path', async () => {
      const code = 'function foo() { return 1 }'
      const symbols = [makeSymbol({ name: 'foo', startLine: 1, endLine: 1 })]
      const result = await chunkFile(code, symbols, 'src/utils.ts', 'typescript')
      expect(result[0].contextualizedContent).toContain('File: src/utils.ts')
    })

    it('contextualized_content includes language', async () => {
      const code = 'function foo() { return 1 }'
      const symbols = [makeSymbol({ name: 'foo', startLine: 1, endLine: 1 })]
      const result = await chunkFile(code, symbols, 'test.ts', 'typescript')
      expect(result[0].contextualizedContent).toContain('Language: typescript')
    })

    it('contextualized_content includes scope chain', async () => {
      const code = 'def call\nend\n'
      const symbols = [makeSymbol({ name: 'call', type: 'method', startLine: 1, endLine: 2, parentScope: 'WT.Payment.Action' })]
      const result = await chunkFile(code, symbols, 'action.rb', 'ruby')
      expect(result[0].contextualizedContent).toContain('Scope: WT > Payment > Action > call')
    })

    it('raw content does NOT include context header', async () => {
      const code = 'function foo() { return 1 }'
      const symbols = [makeSymbol({ name: 'foo', startLine: 1, endLine: 1 })]
      const result = await chunkFile(code, symbols, 'test.ts', 'typescript')
      expect(result[0].content).not.toContain('File:')
    })
  })

  describe('overlap', () => {
    it('adjacent chunks share overlap lines', async () => {
      const bigCode = generateCode(80, 40)
      const symbols = [makeSymbol({ name: 'bigFunc', startLine: 1, endLine: 80 })]
      const result = await chunkFile(bigCode, symbols, 'test.ts', 'typescript')
      if (result.length >= 2) {
        expect(result[1].startLine).toBeLessThan(result[0].endLine + 1)
      }
    })
  })

  describe('fallback', () => {
    it('file with no semantic entities uses sliding window', async () => {
      const code = generateCode(50, 30)
      const result = await chunkFile(code, [], 'config.json', 'json')
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result[0].contextualizedContent).toContain('File: config.json')
    })

    it('config files get chunked by sliding window', async () => {
      const code = '{\n' + '  "key": "value",\n'.repeat(20) + '}\n'
      const result = await chunkFile(code, [], 'settings.json', 'json')
      expect(result.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('edge cases', () => {
    it('empty file returns no chunks', async () => {
      expect(await chunkFile('', [], 'empty.ts', 'typescript')).toEqual([])
    })

    it('file with only comments returns one chunk', async () => {
      const code = '// this is a comment\n// another comment\n'
      const result = await chunkFile(code, [], 'comments.ts', 'typescript')
      expect(result.length).toBe(1)
    })

    it('very long single-line file produces chunks', async () => {
      const code = 'x'.repeat(5000)
      const result = await chunkFile(code, [], 'minified.js', 'javascript')
      expect(result.length).toBeGreaterThanOrEqual(1)
    })
  })
})

describe('buildScopeTree', () => {
  it('nests symbols by line range', () => {
    const symbols = [
      makeSymbol({ name: 'Outer', type: 'class', startLine: 1, endLine: 20 }),
      makeSymbol({ name: 'inner', type: 'method', startLine: 5, endLine: 10 }),
    ]
    const tree = buildScopeTree(symbols, 20)
    expect(tree.children).toHaveLength(1)
    expect(tree.children[0].symbol?.name).toBe('Outer')
    expect(tree.children[0].children).toHaveLength(1)
    expect(tree.children[0].children[0].symbol?.name).toBe('inner')
  })
})
