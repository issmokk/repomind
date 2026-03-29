import type {
  RetrievalResult,
  HybridSearchResult as _HybridSearchResult,
  GraphContextEntry,
  ContextWindow,
  PromptTemplate,
} from './types'

const CORE_INSTRUCTIONS = `You are a code assistant. Your answers must be grounded in the provided source code context.

For every claim about the code, cite the source using filePath:lineStart-lineEnd format (e.g., src/lib/config.ts:15-30).

If the provided context does not contain enough information to answer the question, say so explicitly. Do not guess or fabricate code that is not in the context.

Explain code architecture and design decisions. Do not just repeat code verbatim.

When showing code examples, reference actual code from the context, not hypothetical code.`

export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  typescript: {
    language: 'typescript',
    systemPrompt: `${CORE_INSTRUCTIONS}\n\nYou are working with a TypeScript codebase. Pay attention to React component patterns, hook conventions, type safety, and Next.js App Router patterns (Server Components, Server Actions, route handlers). Note async request APIs in Next.js 16+.`,
    contextFormat: '',
  },
  ruby: {
    language: 'ruby',
    systemPrompt: `${CORE_INSTRUCTIONS}\n\nYou are working with a Ruby codebase. Pay attention to Grape API patterns, Mongoid/ActiveRecord models, RSpec test conventions, module/concern patterns, and service object architecture.`,
    contextFormat: '',
  },
  python: {
    language: 'python',
    systemPrompt: `${CORE_INSTRUCTIONS}\n\nYou are working with a Python codebase. Pay attention to decorator patterns, type hints, common frameworks (Django, FastAPI, Flask), and Pythonic idioms.`,
    contextFormat: '',
  },
  go: {
    language: 'go',
    systemPrompt: `${CORE_INSTRUCTIONS}\n\nYou are working with a Go codebase. Pay attention to error handling patterns, goroutines and channels, interface conventions, and the standard library.`,
    contextFormat: '',
  },
  java: {
    language: 'java',
    systemPrompt: `${CORE_INSTRUCTIONS}\n\nYou are working with a Java codebase. Pay attention to Spring patterns, interface/implementation conventions, annotation patterns, and dependency injection.`,
    contextFormat: '',
  },
  rust: {
    language: 'rust',
    systemPrompt: `${CORE_INSTRUCTIONS}\n\nYou are working with a Rust codebase. Pay attention to ownership and borrowing, trait patterns, error handling with Result/Option, and lifetime annotations.`,
    contextFormat: '',
  },
  generic: {
    language: 'generic',
    systemPrompt: CORE_INSTRUCTIONS,
    contextFormat: '',
  },
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function selectTemplate(
  chunks: Array<{ language: string | null }>,
  explicitLanguage?: string | null
): PromptTemplate {
  if (explicitLanguage && PROMPT_TEMPLATES[explicitLanguage.toLowerCase()]) {
    return PROMPT_TEMPLATES[explicitLanguage.toLowerCase()]
  }

  const langCounts = new Map<string, number>()
  for (const chunk of chunks) {
    if (chunk.language) {
      const lang = chunk.language.toLowerCase()
      langCounts.set(lang, (langCounts.get(lang) ?? 0) + 1)
    }
  }

  let majorityLang = ''
  let maxCount = 0
  for (const [lang, count] of langCounts) {
    if (count > maxCount) {
      majorityLang = lang
      maxCount = count
    }
  }

  if (majorityLang === 'javascript') majorityLang = 'typescript'

  return PROMPT_TEMPLATES[majorityLang] ?? PROMPT_TEMPLATES.generic
}

export function formatChunk(
  chunk: {
    filePath: string
    startLine: number
    endLine: number
    language: string | null
    symbolName?: string | null
    symbolType?: string | null
    contextualizedContent: string
  },
  _isGraphContext?: boolean
): string {
  const lines = [`--- Source: ${chunk.filePath} (lines ${chunk.startLine}-${chunk.endLine}) ---`]

  const parts = []
  if (chunk.language) parts.push(`Language: ${chunk.language}`)
  if (chunk.symbolName) {
    parts.push(`Symbol: ${chunk.symbolName}${chunk.symbolType ? ` (${chunk.symbolType})` : ''}`)
  }
  if (parts.length > 0) lines.push(parts.join(' | '))

  lines.push(chunk.contextualizedContent)

  return lines.join('\n')
}

function formatGraphEntry(entry: GraphContextEntry): string {
  const edge = entry.edge
  const relLine = `Relationship: ${edge.relationshipType} | ${edge.sourceSymbol} -> ${edge.targetSymbol}`
  const hopLine = `Hop: ${entry.hop}`
  const lines = [relLine, hopLine]
  if (entry.chunkContent) {
    lines.push(entry.chunkContent)
  }
  return lines.join('\n')
}

export function buildContextWindow(
  query: string,
  retrievalResult: RetrievalResult,
  config: { tokenBudget?: number; explicitLanguage?: string | null }
): ContextWindow {
  const template = selectTemplate(retrievalResult.chunks, config.explicitLanguage)
  const budget = config.tokenBudget ?? 100000

  let usedTokens = estimateTokens(template.systemPrompt) + estimateTokens(query)

  const primaryFormatted: string[] = []
  for (const chunk of retrievalResult.chunks) {
    const formatted = formatChunk(chunk)
    const tokens = estimateTokens(formatted)
    if (primaryFormatted.length === 0 || usedTokens + tokens <= budget) {
      primaryFormatted.push(formatted)
      usedTokens += tokens
    }
  }

  const graphFormatted: string[] = []
  const sortedGraph = [...retrievalResult.graphContext].sort((a, b) => a.hop - b.hop)
  for (const entry of sortedGraph) {
    const formatted = formatGraphEntry(entry)
    const tokens = estimateTokens(formatted)
    if (usedTokens + tokens <= budget) {
      graphFormatted.push(formatted)
      usedTokens += tokens
    }
  }

  const contextChunks =
    primaryFormatted.length > 0
      ? `## Retrieved Context\n\n${primaryFormatted.join('\n\n')}`
      : ''

  const graphContextStr =
    graphFormatted.length > 0
      ? `## Related Context\n\n${graphFormatted.join('\n\n')}`
      : ''

  return {
    systemPrompt: template.systemPrompt,
    contextChunks,
    graphContext: graphContextStr,
    userQuery: query,
    estimatedTokens: usedTokens,
  }
}
