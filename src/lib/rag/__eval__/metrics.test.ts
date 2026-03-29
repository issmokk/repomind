// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  extractCitations,
  sourceAccuracy,
  contextPrecision,
  hallucinationRate,
  computeSummary,
} from './metrics'

describe('extractCitations', () => {
  it('extracts file:line-line patterns from text', () => {
    const text = 'The chunker at src/lib/chunker.ts:45-89 does X. Also see src/parser.ts:10-20.'
    const citations = extractCitations(text)
    expect(citations).toHaveLength(2)
    expect(citations[0]).toEqual({ filePath: 'src/lib/chunker.ts', lineStart: 45, lineEnd: 89 })
    expect(citations[1]).toEqual({ filePath: 'src/parser.ts', lineStart: 10, lineEnd: 20 })
  })

  it('returns empty array when no citations found', () => {
    expect(extractCitations('No citations here.')).toEqual([])
  })
})

describe('sourceAccuracy', () => {
  it('returns 1.0 when all citations match expected', () => {
    const cited = [{ filePath: 'a.ts', lineStart: 10, lineEnd: 20 }]
    const expected = [{ filePath: 'a.ts', lineStart: 5, lineEnd: 25 }]
    expect(sourceAccuracy(cited, expected)).toBe(1.0)
  })

  it('returns 0.0 when no citations match', () => {
    const cited = [{ filePath: 'a.ts', lineStart: 10, lineEnd: 20 }]
    const expected = [{ filePath: 'b.ts', lineStart: 10, lineEnd: 20 }]
    expect(sourceAccuracy(cited, expected)).toBe(0.0)
  })

  it('returns 0 for empty cited array', () => {
    expect(sourceAccuracy([], [{ filePath: 'a.ts', lineStart: 1, lineEnd: 10 }])).toBe(0)
  })
})

describe('contextPrecision', () => {
  it('returns 1.0 when all top-K chunks are relevant', () => {
    const chunks = [
      { filePath: 'a.ts', startLine: 10, endLine: 20 },
      { filePath: 'b.ts', startLine: 5, endLine: 15 },
    ]
    const expected = [
      { filePath: 'a.ts', lineStart: 10, lineEnd: 20 },
      { filePath: 'b.ts', lineStart: 5, lineEnd: 15 },
    ]
    expect(contextPrecision(chunks, expected, 2)).toBe(1.0)
  })

  it('returns 0.5 when half of top-K are relevant', () => {
    const chunks = [
      { filePath: 'a.ts', startLine: 10, endLine: 20 },
      { filePath: 'c.ts', startLine: 1, endLine: 5 },
    ]
    const expected = [{ filePath: 'a.ts', lineStart: 10, lineEnd: 20 }]
    expect(contextPrecision(chunks, expected, 2)).toBe(0.5)
  })
})

describe('hallucinationRate', () => {
  it('returns true when faithfulness < 0.5', () => {
    expect(hallucinationRate(0.3)).toBe(true)
  })

  it('returns false when faithfulness >= 0.5', () => {
    expect(hallucinationRate(0.8)).toBe(false)
  })
})

describe('computeSummary', () => {
  it('computes correct aggregates', () => {
    const scores = [
      { faithfulness: 0.8, answerRelevance: 0.9, sourceAccuracy: 1.0, contextPrecision: 0.7, hallucinated: false },
      { faithfulness: 0.6, answerRelevance: 0.7, sourceAccuracy: 0.8, contextPrecision: 0.5, hallucinated: true },
    ]
    const summary = computeSummary(scores)
    expect(summary.count).toBe(2)
    expect(summary.faithfulness.mean).toBe(0.7)
    expect(summary.faithfulness.min).toBe(0.6)
    expect(summary.faithfulness.max).toBe(0.8)
    expect(summary.hallucinationRate).toBe(0.5)
  })

  it('handles empty input', () => {
    const summary = computeSummary([])
    expect(summary.count).toBe(0)
    expect(summary.hallucinationRate).toBe(0)
  })
})
