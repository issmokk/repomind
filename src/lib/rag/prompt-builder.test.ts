// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  selectTemplate,
  formatChunk,
  estimateTokens,
  buildContextWindow,
  PROMPT_TEMPLATES,
} from './prompt-builder'
import type { RetrievalResult as _RetrievalResult, HybridSearchResult, GraphContextEntry as _GraphContextEntry } from './types'

function makeChunk(overrides: Partial<HybridSearchResult> = {}): HybridSearchResult {
  return {
    id: 1,
    repoId: 'repo-1',
    filePath: 'src/test.ts',
    chunkIndex: 0,
    content: 'function test() { return true }',
    contextualizedContent: 'File: src/test.ts\nfunction test() { return true }',
    language: 'typescript',
    symbolName: 'test',
    symbolType: 'function',
    startLine: 1,
    endLine: 5,
    parentScope: null,
    rrfScore: 0.03,
    vectorRank: 1,
    ftsRank: 1,
    vectorSimilarity: 0.9,
    ...overrides,
  }
}

describe('selectTemplate', () => {
  it('selects TypeScript when majority of chunks are TypeScript', () => {
    const chunks = [
      makeChunk({ language: 'typescript' }),
      makeChunk({ language: 'typescript' }),
      makeChunk({ language: 'typescript' }),
      makeChunk({ language: 'ruby' }),
    ]
    const template = selectTemplate(chunks)
    expect(template.language).toBe('typescript')
  })

  it('selects Ruby when explicit language filter is Ruby', () => {
    const chunks = [
      makeChunk({ language: 'typescript' }),
      makeChunk({ language: 'typescript' }),
    ]
    const template = selectTemplate(chunks, 'ruby')
    expect(template.language).toBe('ruby')
  })

  it('falls back to generic for unsupported languages', () => {
    const chunks = [makeChunk({ language: 'haskell' })]
    const template = selectTemplate(chunks)
    expect(template.language).toBe('generic')
  })

  it('treats javascript as typescript', () => {
    const chunks = [
      makeChunk({ language: 'javascript' }),
      makeChunk({ language: 'javascript' }),
    ]
    const template = selectTemplate(chunks)
    expect(template.language).toBe('typescript')
  })
})

describe('formatChunk', () => {
  it('formats with file path and line range header', () => {
    const result = formatChunk({
      filePath: 'src/lib/config.ts',
      startLine: 10,
      endLine: 30,
      language: 'typescript',
      symbolName: 'parseConfig',
      symbolType: 'function',
      contextualizedContent: 'File: src/lib/config.ts\nfunction parseConfig() {}',
    })
    expect(result).toContain('--- Source: src/lib/config.ts (lines 10-30) ---')
    expect(result).toContain('Language: typescript | Symbol: parseConfig (function)')
    expect(result).toContain('function parseConfig() {}')
  })

  it('omits symbol when symbolName is null', () => {
    const result = formatChunk({
      filePath: 'src/test.ts',
      startLine: 1,
      endLine: 5,
      language: 'typescript',
      symbolName: null,
      symbolType: null,
      contextualizedContent: 'code here',
    })
    expect(result).not.toContain('Symbol:')
  })
})

describe('estimateTokens', () => {
  it('returns content.length / 4 rounded up', () => {
    expect(estimateTokens('a'.repeat(400))).toBe(100)
    expect(estimateTokens('a'.repeat(401))).toBe(101)
    expect(estimateTokens('')).toBe(0)
  })
})

describe('buildContextWindow', () => {
  it('separates primary context from graph context', () => {
    const result = buildContextWindow('what does test do', {
      chunks: [makeChunk()],
      graphContext: [{
        edge: {
          id: 1, repoId: 'repo-1', targetRepoId: null, sourceFile: 'a.ts', sourceSymbol: 'foo',
          sourceType: 'function', targetFile: 'b.ts', targetSymbol: 'bar',
          targetType: 'function', relationshipType: 'calls' as const,
          metadata: {}, createdAt: '',
        },
        hop: 1,
        sourceSymbol: 'a.ts:foo',
      }],
      totalCandidates: 1,
      confidence: 'high',
      sources: [],
    }, {})

    expect(result.contextChunks).toContain('## Retrieved Context')
    expect(result.graphContext).toContain('## Related Context')
  })

  it('includes relationship type in graph context', () => {
    const result = buildContextWindow('test', {
      chunks: [makeChunk()],
      graphContext: [{
        edge: {
          id: 1, repoId: 'repo-1', targetRepoId: null, sourceFile: 'a.ts', sourceSymbol: 'foo',
          sourceType: 'function', targetFile: 'b.ts', targetSymbol: 'bar',
          targetType: 'function', relationshipType: 'calls' as const,
          metadata: {}, createdAt: '',
        },
        hop: 1,
        sourceSymbol: 'a.ts:foo',
      }],
      totalCandidates: 1,
      confidence: 'high',
      sources: [],
    }, {})

    expect(result.graphContext).toContain('Relationship: calls')
  })

  it('truncates context when token budget exceeded', () => {
    const bigContent = 'x'.repeat(4000)
    const chunks = Array.from({ length: 10 }, (_, i) =>
      makeChunk({ id: i, contextualizedContent: bigContent })
    )

    const result = buildContextWindow('test', {
      chunks,
      graphContext: [{
        edge: {
          id: 1, repoId: 'repo-1', targetRepoId: null, sourceFile: 'a.ts', sourceSymbol: 'foo',
          sourceType: 'function', targetFile: 'b.ts', targetSymbol: 'bar',
          targetType: 'function', relationshipType: 'calls' as const,
          metadata: {}, createdAt: '',
        },
        hop: 1,
        sourceSymbol: 'a.ts:foo',
        chunkContent: bigContent,
      }],
      totalCandidates: 10,
      confidence: 'high',
      sources: [],
    }, { tokenBudget: 4000 })

    expect(result.estimatedTokens).toBeLessThanOrEqual(4000 + 1100)
    expect(result.graphContext).toBe('')
  })

  it('system prompt includes citation instruction', () => {
    for (const template of Object.values(PROMPT_TEMPLATES)) {
      expect(template.systemPrompt).toContain('filePath:lineStart-lineEnd')
    }
  })

  it('system prompt includes "do not have enough context" instruction', () => {
    for (const template of Object.values(PROMPT_TEMPLATES)) {
      expect(template.systemPrompt.toLowerCase()).toContain('not contain enough information')
    }
  })
})
