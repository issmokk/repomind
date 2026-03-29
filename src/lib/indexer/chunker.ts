import type { SymbolInfo } from './ast-analyzer'
import type { ChunkResult } from '@/types/indexing'

export const TARGET_MIN_NWS = 1000
export const TARGET_MAX_NWS = 2000
export const MERGE_THRESHOLD_NWS = 200
export const OVERLAP_LINES = 10

interface ScopeNode {
  symbol: SymbolInfo | null
  children: ScopeNode[]
  startLine: number
  endLine: number
}

interface RawChunk {
  startLine: number
  endLine: number
  symbolName: string | null
  symbolType: string | null
  parentScope: string | null
}

export function countNonWhitespace(text: string): number {
  let count = 0
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c !== 32 && c !== 9 && c !== 10 && c !== 13) count++
  }
  return count
}

function getLines(code: string): string[] {
  return code.split('\n')
}

function getLinesText(lines: string[], startLine: number, endLine: number): string {
  return lines.slice(startLine - 1, endLine).join('\n')
}

export function buildScopeTree(symbols: SymbolInfo[], totalLines: number): ScopeNode {
  const sorted = [...symbols].sort((a, b) => {
    if (a.startLine !== b.startLine) return a.startLine - b.startLine
    return (b.endLine - b.startLine) - (a.endLine - a.startLine)
  })

  const root: ScopeNode = { symbol: null, children: [], startLine: 1, endLine: totalLines }

  for (const sym of sorted) {
    let parent = root
    let placed = false
    while (!placed) {
      let foundChild = false
      for (const child of parent.children) {
        if (sym.startLine >= child.startLine && sym.endLine <= child.endLine) {
          parent = child
          foundChild = true
          break
        }
      }
      if (!foundChild) {
        parent.children.push({
          symbol: sym,
          children: [],
          startLine: sym.startLine,
          endLine: sym.endLine,
        })
        placed = true
      }
    }
  }

  return root
}

function packChunks(node: ScopeNode, lines: string[]): RawChunk[] {
  const text = getLinesText(lines, node.startLine, node.endLine)
  const nws = countNonWhitespace(text)

  if (nws <= TARGET_MAX_NWS) {
    if (node.symbol === null && node.children.length > 0) {
      return node.children.flatMap((child) => packChunks(child, lines))
    }
    return [{
      startLine: node.startLine,
      endLine: node.endLine,
      symbolName: node.symbol?.name ?? null,
      symbolType: node.symbol?.type ?? null,
      parentScope: node.symbol?.parentScope ?? null,
    }]
  }

  if (node.children.length === 0) {
    return slidingWindowRaw(lines, node.startLine, node.endLine)
  }

  const chunks: RawChunk[] = []
  let lastEnd = node.startLine

  for (const child of node.children) {
    if (child.startLine > lastEnd) {
      const gapText = getLinesText(lines, lastEnd, child.startLine - 1)
      if (countNonWhitespace(gapText) > 0) {
        chunks.push({
          startLine: lastEnd,
          endLine: child.startLine - 1,
          symbolName: null,
          symbolType: null,
          parentScope: node.symbol?.parentScope ?? null,
        })
      }
    }
    chunks.push(...packChunks(child, lines))
    lastEnd = child.endLine + 1
  }

  if (lastEnd <= node.endLine) {
    const gapText = getLinesText(lines, lastEnd, node.endLine)
    if (countNonWhitespace(gapText) > 0) {
      chunks.push({
        startLine: lastEnd,
        endLine: node.endLine,
        symbolName: null,
        symbolType: null,
        parentScope: node.symbol?.parentScope ?? null,
      })
    }
  }

  return chunks
}

function slidingWindowRaw(lines: string[], startLine: number, endLine: number): RawChunk[] {
  const chunks: RawChunk[] = []
  let current = startLine

  while (current <= endLine) {
    let end = current
    let nws = 0
    while (end <= endLine && nws < TARGET_MIN_NWS) {
      nws += countNonWhitespace(lines[end - 1] ?? '')
      end++
    }
    end = Math.min(end, endLine + 1)
    chunks.push({
      startLine: current,
      endLine: end - 1,
      symbolName: null,
      symbolType: null,
      parentScope: null,
    })
    current = Math.max(current + 1, end - OVERLAP_LINES)
  }

  return chunks
}

export function mergeSmallChunks(chunks: RawChunk[], lines: string[]): RawChunk[] {
  if (chunks.length === 0) return []

  const result: RawChunk[] = []

  for (const chunk of chunks) {
    const chunkText = getLinesText(lines, chunk.startLine, chunk.endLine)
    const chunkNws = countNonWhitespace(chunkText)

    if (chunkNws < MERGE_THRESHOLD_NWS && result.length > 0) {
      const prev = result[result.length - 1]
      prev.endLine = chunk.endLine
      if (!prev.symbolName && chunk.symbolName) {
        prev.symbolName = chunk.symbolName
        prev.symbolType = chunk.symbolType
        prev.parentScope = chunk.parentScope
      }
    } else if (result.length > 0) {
      const prev = result[result.length - 1]
      const prevText = getLinesText(lines, prev.startLine, prev.endLine)
      if (countNonWhitespace(prevText) < MERGE_THRESHOLD_NWS) {
        prev.endLine = chunk.endLine
        if (!prev.symbolName && chunk.symbolName) {
          prev.symbolName = chunk.symbolName
          prev.symbolType = chunk.symbolType
          prev.parentScope = chunk.parentScope
        }
      } else {
        result.push({ ...chunk })
      }
    } else {
      result.push({ ...chunk })
    }
  }

  return result
}

export function addOverlap(chunks: RawChunk[], _totalLines: number): RawChunk[] {
  if (chunks.length <= 1) return chunks
  const result = [chunks[0]]
  for (let i = 1; i < chunks.length; i++) {
    const newStart = Math.max(1, chunks[i].startLine - OVERLAP_LINES)
    result.push({ ...chunks[i], startLine: newStart })
  }
  return result
}

function buildContextHeader(
  filePath: string,
  language: string,
  symbolName: string | null,
  parentScope: string | null,
  imports?: string[],
): string {
  const parts = [`File: ${filePath}`, `Language: ${language}`]
  const scopeParts: string[] = []
  if (parentScope) scopeParts.push(...parentScope.split('.'))
  if (symbolName) scopeParts.push(symbolName)
  if (scopeParts.length > 0) parts.push(`Scope: ${scopeParts.join(' > ')}`)
  if (imports && imports.length > 0) parts.push(`Imports: ${imports.join(', ')}`)
  return parts.join('\n')
}

export async function chunkFile(
  code: string,
  symbols: SymbolInfo[],
  filePath: string,
  language: string,
  imports?: string[],
): Promise<ChunkResult[]> {
  const lines = getLines(code)
  if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) return []

  let rawChunks: RawChunk[]

  if (symbols.length === 0) {
    rawChunks = slidingWindowRaw(lines, 1, lines.length)
  } else {
    const tree = buildScopeTree(symbols, lines.length)
    rawChunks = packChunks(tree, lines)
  }

  rawChunks = mergeSmallChunks(rawChunks, lines)
  rawChunks = addOverlap(rawChunks, lines.length)

  return rawChunks.map((chunk, index) => {
    const content = getLinesText(lines, chunk.startLine, chunk.endLine)
    const header = buildContextHeader(filePath, language, chunk.symbolName, chunk.parentScope, imports)
    return {
      content,
      contextualizedContent: `${header}\n---\n${content}`,
      language,
      symbolName: chunk.symbolName,
      symbolType: chunk.symbolType,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      parentScope: chunk.parentScope,
      chunkIndex: index,
    }
  })
}
