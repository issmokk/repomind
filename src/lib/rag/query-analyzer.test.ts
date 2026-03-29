// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { analyzeQuery } from './query-analyzer'

describe('analyzeQuery', () => {
  it('classifies "what does function X do" as factual with depth 1', () => {
    const result = analyzeQuery('what does the parseConfig function do')
    expect(result.queryType).toBe('factual')
    expect(result.suggestedGraphDepth).toBe(1)
  })

  it('classifies "where is X defined" as factual with depth 1', () => {
    const result = analyzeQuery('where is buildScopeTree defined')
    expect(result.queryType).toBe('factual')
    expect(result.suggestedGraphDepth).toBe(1)
  })

  it('classifies "show me X" as factual with depth 1', () => {
    const result = analyzeQuery('show me the authentication middleware')
    expect(result.queryType).toBe('factual')
    expect(result.suggestedGraphDepth).toBe(1)
  })

  it('classifies "how does X connect to Y" as architectural with depth 2+', () => {
    const result = analyzeQuery('how does the payment service connect to the ledger')
    expect(result.queryType).toBe('architectural')
    expect(result.suggestedGraphDepth).toBeGreaterThanOrEqual(2)
  })

  it('classifies "architecture of" as architectural', () => {
    const result = analyzeQuery('what is the architecture of the indexing pipeline')
    expect(result.queryType).toBe('architectural')
  })

  it('classifies "call chain for" as architectural', () => {
    const result = analyzeQuery('show the call chain for processFile')
    expect(result.queryType).toBe('architectural')
  })

  it('classifies "dependency between" as architectural', () => {
    const result = analyzeQuery('what is the dependency between chunker and parser')
    expect(result.queryType).toBe('architectural')
  })

  it('classifies "why is X failing" as debugging with depth 2', () => {
    const result = analyzeQuery('why is the authentication failing on login')
    expect(result.queryType).toBe('debugging')
    expect(result.suggestedGraphDepth).toBe(2)
  })

  it('classifies "bug in X" as debugging', () => {
    const result = analyzeQuery('there is a bug in the chunker')
    expect(result.queryType).toBe('debugging')
  })

  it('classifies "error when X" as debugging', () => {
    const result = analyzeQuery('error when running the indexing pipeline')
    expect(result.queryType).toBe('debugging')
  })

  it('classifies "explain how X works" as explanation with depth 2', () => {
    const result = analyzeQuery('explain how the embedding pipeline works')
    expect(result.queryType).toBe('explanation')
    expect(result.suggestedGraphDepth).toBe(2)
  })

  it('classifies "walk me through" as explanation', () => {
    const result = analyzeQuery('walk me through the auth callback flow')
    expect(result.queryType).toBe('explanation')
  })

  it('defaults to factual with depth 1 for unrecognized queries', () => {
    const result = analyzeQuery('hello world')
    expect(result.queryType).toBe('factual')
    expect(result.suggestedGraphDepth).toBe(1)
  })

  it('detects language mention "in the Ruby code"', () => {
    const result = analyzeQuery('what does the process method do in the Ruby code')
    expect(result.detectedLanguage).toBe('ruby')
  })

  it('detects language mention "TypeScript function"', () => {
    const result = analyzeQuery('show me the TypeScript function for parsing')
    expect(result.detectedLanguage).toBe('typescript')
  })

  it('detects language mention "Python file"', () => {
    const result = analyzeQuery('where is the Python file for data processing')
    expect(result.detectedLanguage).toBe('python')
  })

  it('returns null detectedLanguage when no language mentioned', () => {
    const result = analyzeQuery('what does parseConfig do')
    expect(result.detectedLanguage).toBeNull()
  })

  it('admin maxGraphHops override caps suggestedGraphDepth', () => {
    const result = analyzeQuery('explain the architecture of the payment system', {
      maxGraphHops: 1,
    })
    expect(result.suggestedGraphDepth).toBe(1)
  })

  it('does not cap when maxGraphHops is not set', () => {
    const result = analyzeQuery('how does X connect to Y')
    expect(result.suggestedGraphDepth).toBeGreaterThanOrEqual(2)
  })

  it('does not false-positive "go" in "go into a loop"', () => {
    const result = analyzeQuery('why does the code go into an infinite loop')
    expect(result.detectedLanguage).toBeNull()
  })

  it('does not false-positive "swift" in "too swift"', () => {
    const result = analyzeQuery('the response is too swift for the client')
    expect(result.detectedLanguage).toBeNull()
  })

  it('searchEmphasis defaults to balanced', () => {
    const result = analyzeQuery('what does parseConfig do')
    expect(result.searchEmphasis).toBe('balanced')
  })
})
