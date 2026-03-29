import { readFile } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  type EvalTestCase,
  type MetricScores,
  type MetricSummary,
  extractCitations,
  sourceAccuracy,
  contextPrecision,
  hallucinationRate,
  faithfulness,
  answerRelevance,
  computeSummary,
} from './metrics'

const __dirname = dirname(fileURLToPath(import.meta.url))

export type EvalCaseResult = {
  question: string
  repoId: string
  generatedAnswer: string
  citedSources: Array<{ filePath: string; lineStart: number; lineEnd: number }>
  metrics: MetricScores
  latency: { retrievalMs: number; generationMs: number; totalMs: number }
}

export type EvalResults = {
  goldenResults: EvalCaseResult[]
  syntheticResults: EvalCaseResult[]
  goldenSummary: MetricSummary
  syntheticSummary: MetricSummary
}

type RagPipeline = (
  question: string,
  repoId: string
) => Promise<{
  answer: string
  sources: Array<{ filePath: string; lineStart: number; lineEnd: number }>
  retrievedChunks: Array<{ filePath: string; startLine: number; endLine: number; content: string }>
  retrievalMs: number
  generationMs: number
}>

type LlmJudge = (prompt: string) => Promise<string>

async function loadDataset(path: string): Promise<EvalTestCase[]> {
  try {
    const content = await readFile(path, 'utf-8')
    return JSON.parse(content) as EvalTestCase[]
  } catch {
    return []
  }
}

async function evaluateCase(
  testCase: EvalTestCase,
  pipeline: RagPipeline,
  judge: LlmJudge
): Promise<EvalCaseResult> {
  const start = performance.now()
  const result = await pipeline(testCase.question, testCase.repoId)
  const totalMs = Math.round(performance.now() - start)

  const cited = extractCitations(result.answer)
  const contextTexts = result.retrievedChunks.map((c) => c.content)

  const [faithScore, relevanceScore] = await Promise.all([
    faithfulness(result.answer, contextTexts, judge),
    answerRelevance(testCase.question, result.answer, judge),
  ])

  const srcAccuracy = sourceAccuracy(cited, testCase.expectedSources)
  const ctxPrecision = contextPrecision(result.retrievedChunks, testCase.expectedSources, 10)
  const hallucinated = hallucinationRate(faithScore)

  return {
    question: testCase.question,
    repoId: testCase.repoId,
    generatedAnswer: result.answer,
    citedSources: cited,
    metrics: {
      faithfulness: faithScore,
      answerRelevance: relevanceScore,
      sourceAccuracy: srcAccuracy,
      contextPrecision: ctxPrecision,
      hallucinated,
    },
    latency: {
      retrievalMs: result.retrievalMs,
      generationMs: result.generationMs,
      totalMs,
    },
  }
}

export async function runEvaluation(options: {
  goldenDatasetPath?: string
  syntheticDatasetPath?: string
  pipeline: RagPipeline
  judge: LlmJudge
}): Promise<EvalResults> {
  const goldenPath = options.goldenDatasetPath ?? resolve(__dirname, 'datasets/golden.json')
  const syntheticPath = options.syntheticDatasetPath ?? resolve(__dirname, 'datasets/synthetic.json')

  const [golden, synthetic] = await Promise.all([
    loadDataset(goldenPath),
    loadDataset(syntheticPath),
  ])

  const goldenResults: EvalCaseResult[] = []
  for (const testCase of golden) {
    goldenResults.push(await evaluateCase(testCase, options.pipeline, options.judge))
  }

  const syntheticResults: EvalCaseResult[] = []
  for (const testCase of synthetic) {
    syntheticResults.push(await evaluateCase(testCase, options.pipeline, options.judge))
  }

  return {
    goldenResults,
    syntheticResults,
    goldenSummary: computeSummary(goldenResults.map((r) => r.metrics)),
    syntheticSummary: computeSummary(syntheticResults.map((r) => r.metrics)),
  }
}

export async function runABComparison(options: {
  dataset: EvalTestCase[]
  pipelineA: RagPipeline
  pipelineB: RagPipeline
  judge: LlmJudge
}): Promise<{ configA: { results: EvalCaseResult[]; summary: MetricSummary }; configB: { results: EvalCaseResult[]; summary: MetricSummary } }> {
  const resultsA: EvalCaseResult[] = []
  const resultsB: EvalCaseResult[] = []

  for (const testCase of options.dataset) {
    const [a, b] = await Promise.all([
      evaluateCase(testCase, options.pipelineA, options.judge),
      evaluateCase(testCase, options.pipelineB, options.judge),
    ])
    resultsA.push(a)
    resultsB.push(b)
  }

  const summaryA = computeSummary(resultsA.map((r) => r.metrics))
  const summaryB = computeSummary(resultsB.map((r) => r.metrics))

  return {
    configA: {
      results: resultsA,
      summary: summaryA,
    },
    configB: {
      results: resultsB,
      summary: summaryB,
    },
  }
}
