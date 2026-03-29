import type { QueryAnalysis } from './types'

const ARCHITECTURAL_PATTERNS = [
  /\bconnect\b/i,
  /\brelate\b/i,
  /\barchitecture\b/i,
  /\bcall\s+chain\b/i,
  /\bcall\s+graph\b/i,
  /\bdependenc/i,
  /\bdepends\s+on\b/i,
  /\bflow\s+between\b/i,
  /\binteraction\s+between\b/i,
]

const DEBUGGING_PATTERNS = [
  /\bfailing\b/i,
  /\bfail\b/i,
  /\bbug\b/i,
  /\berror\b/i,
  /\bbroken\b/i,
  /\bwrong\b/i,
  /\bcrash/i,
  /\bexception\b/i,
  /\bissue\s+with\b/i,
  /\bproblem\s+with\b/i,
  /\bnot\s+working\b/i,
]

const EXPLANATION_PATTERNS = [
  /\bexplain\b/i,
  /\bhow\s+does\b.*\bwork/i,
  /\bwalk\s+me\s+through\b/i,
  /\bdescribe\s+how\b/i,
]

const FACTUAL_PATTERNS = [
  /\bwhat\s+does\b/i,
  /\bwhat\s+is\b/i,
  /\bwhere\s+is\b/i,
  /\bshow\s+me\b/i,
  /\bfind\b/i,
  /\blocate\b/i,
  /\bdefinition\s+of\b/i,
  /\bsignature\s+of\b/i,
]

const LANGUAGE_MAP: Array<[string, RegExp]> = [
  ['typescript', /\btypescript\b/i],
  ['javascript', /\bjavascript\b/i],
  ['ruby', /(?:\bin\s+)?ruby\b(?:\s+(?:code|file|function|class|method|module))?/i],
  ['python', /(?:\bin\s+)?python\b(?:\s+(?:code|file|function|class|method|module))?/i],
  ['go', /\bgolang\b|\bgo\s+(?:code|file|function|module|package)\b|\bin\s+go\b/i],
  ['java', /\bjava\b(?!\s*script)/i],
  ['rust', /\brust\s+(?:code|file|function|module|crate|struct|impl)\b|\bin\s+rust\b|\bcargo\b/i],
  ['c++', /\bc\+\+\b/i],
  ['c#', /\bc#\b/i],
  ['php', /\bphp\b/i],
  ['kotlin', /\bkotlin\b/i],
  ['swift', /\bswift\s+(?:code|file|function|class|struct|method|protocol)\b|\bin\s+swift\b|\bswiftui\b/i],
]

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text))
}

function detectLanguage(question: string): string | null {
  for (const [lang, pattern] of LANGUAGE_MAP) {
    if (pattern.test(question)) return lang
  }
  return null
}

function hasTwoIdentifiers(question: string): boolean {
  const identifierPattern = /\b[A-Z][a-zA-Z]+\b/g
  const matches = question.match(identifierPattern)
  return (matches?.length ?? 0) >= 2
}

export function analyzeQuery(
  question: string,
  options?: { maxGraphHops?: number }
): QueryAnalysis {
  let queryType: QueryAnalysis['queryType'] = 'factual'
  let suggestedGraphDepth = 1

  if (matchesAny(question, ARCHITECTURAL_PATTERNS)) {
    queryType = 'architectural'
    suggestedGraphDepth = hasTwoIdentifiers(question) ? 3 : 2
  } else if (matchesAny(question, DEBUGGING_PATTERNS)) {
    queryType = 'debugging'
    suggestedGraphDepth = 2
  } else if (matchesAny(question, EXPLANATION_PATTERNS)) {
    queryType = 'explanation'
    suggestedGraphDepth = 2
  } else if (matchesAny(question, FACTUAL_PATTERNS)) {
    queryType = 'factual'
    suggestedGraphDepth = 1
  }

  if (options?.maxGraphHops !== undefined) {
    suggestedGraphDepth = Math.min(suggestedGraphDepth, options.maxGraphHops)
  }

  return {
    queryType,
    suggestedGraphDepth,
    searchEmphasis: 'balanced',
    detectedLanguage: detectLanguage(question),
  }
}
