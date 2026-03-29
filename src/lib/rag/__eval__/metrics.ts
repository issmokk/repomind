import type { SourceReference as _SourceReference } from '../types'

export type EvalTestCase = {
  question: string
  repoId: string
  expectedSources: Array<{ filePath: string; lineStart: number; lineEnd: number }>
  expectedAnswerContains: string[]
}

export type MetricScores = {
  faithfulness: number
  answerRelevance: number
  sourceAccuracy: number
  contextPrecision: number
  hallucinated: boolean
}

export type MetricSummary = {
  count: number
  faithfulness: { mean: number; min: number; max: number }
  answerRelevance: { mean: number; min: number; max: number }
  sourceAccuracy: { mean: number; min: number; max: number }
  contextPrecision: { mean: number; min: number; max: number }
  hallucinationRate: number
}

export function extractCitations(
  answerText: string
): Array<{ filePath: string; lineStart: number; lineEnd: number }> {
  const pattern = /([\w/.-]+):(\d+)-(\d+)/g
  const citations: Array<{ filePath: string; lineStart: number; lineEnd: number }> = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(answerText)) !== null) {
    citations.push({
      filePath: match[1],
      lineStart: parseInt(match[2], 10),
      lineEnd: parseInt(match[3], 10),
    })
  }
  return citations
}

export function sourceAccuracy(
  citedSources: Array<{ filePath: string; lineStart: number; lineEnd: number }>,
  expectedSources: Array<{ filePath: string; lineStart: number; lineEnd: number }>
): number {
  if (citedSources.length === 0) return 0

  let accurate = 0
  for (const cited of citedSources) {
    const isAccurate = expectedSources.some(
      (expected) =>
        expected.filePath === cited.filePath &&
        cited.lineStart <= expected.lineEnd &&
        cited.lineEnd >= expected.lineStart
    )
    if (isAccurate) accurate++
  }
  return accurate / citedSources.length
}

export function contextPrecision(
  retrievedChunks: Array<{ filePath: string; startLine: number; endLine: number }>,
  expectedSources: Array<{ filePath: string; lineStart: number; lineEnd: number }>,
  k: number
): number {
  const topK = retrievedChunks.slice(0, k)
  if (topK.length === 0) return 0

  let relevant = 0
  for (const chunk of topK) {
    const isRelevant = expectedSources.some(
      (expected) =>
        expected.filePath === chunk.filePath &&
        chunk.startLine <= expected.lineEnd &&
        chunk.endLine >= expected.lineStart
    )
    if (isRelevant) relevant++
  }
  return relevant / topK.length
}

export function hallucinationRate(faithfulnessScore: number): boolean {
  return faithfulnessScore < 0.5
}

export async function faithfulness(
  answer: string,
  contextChunks: string[],
  llmJudge: (prompt: string) => Promise<string>
): Promise<number> {
  const sentences = answer.split(/[.!?]+/).filter((s) => s.trim().length > 10)
  if (sentences.length === 0) return 1.0

  let supported = 0
  const context = contextChunks.join('\n\n')

  for (const sentence of sentences) {
    const prompt = `Given this code context:\n\n${context}\n\nIs this claim supported by the code context above? A claim is supported if the context contains the function, variable, pattern, or behavior described. Do not count general programming knowledge as support. Answer only YES or NO.\n\nClaim: "${sentence.trim()}"`
    const response = await llmJudge(prompt)
    if (response.trim().toUpperCase().startsWith('YES')) supported++
  }

  return supported / sentences.length
}

export async function answerRelevance(
  question: string,
  answer: string,
  llmJudge: (prompt: string) => Promise<string>
): Promise<number> {
  const prompt = `Rate the relevance of this answer to the question on a scale of 1-5.\n\nQuestion: ${question}\n\nAnswer: ${answer}\n\nRespond with only a number (1-5).`
  const response = await llmJudge(prompt)
  const score = parseInt(response.trim(), 10)
  if (isNaN(score) || score < 1 || score > 5) return 0.5
  return score / 5
}

export function computeSummary(scores: MetricScores[]): MetricSummary {
  if (scores.length === 0) {
    return {
      count: 0,
      faithfulness: { mean: 0, min: 0, max: 0 },
      answerRelevance: { mean: 0, min: 0, max: 0 },
      sourceAccuracy: { mean: 0, min: 0, max: 0 },
      contextPrecision: { mean: 0, min: 0, max: 0 },
      hallucinationRate: 0,
    }
  }

  function summarize(values: number[]) {
    return {
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    }
  }

  return {
    count: scores.length,
    faithfulness: summarize(scores.map((s) => s.faithfulness)),
    answerRelevance: summarize(scores.map((s) => s.answerRelevance)),
    sourceAccuracy: summarize(scores.map((s) => s.sourceAccuracy)),
    contextPrecision: summarize(scores.map((s) => s.contextPrecision)),
    hallucinationRate: scores.filter((s) => s.hallucinated).length / scores.length,
  }
}

export const THRESHOLDS = {
  faithfulness: 0.8,
  answerRelevance: 0.75,
  sourceAccuracy: 0.9,
  contextPrecision: 0.7,
  hallucinationRate: 0.05,
} as const
