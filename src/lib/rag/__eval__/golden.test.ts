// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { SupabaseStorageProvider } from '@/lib/storage/supabase'
import { getLanguageModel, getEmbeddingProvider } from '@/lib/rag/providers'
import { analyzeQuery } from '@/lib/rag/query-analyzer'
import { retrieveContext } from '@/lib/rag/retriever'
import { buildContextWindow } from '@/lib/rag/prompt-builder'
import { generateText } from 'ai'
import { runEvaluation, type EvalResults } from './runner'
import { THRESHOLDS } from './metrics'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const canRun = SUPABASE_URL && SUPABASE_SERVICE_KEY

describe.skipIf(!canRun)('Golden dataset evaluation', () => {
  let results: EvalResults

  it('runs the golden dataset through the live RAG pipeline', async () => {
    const serviceClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!)
    const storage = new SupabaseStorageProvider(serviceClient)

    const repo = await storage.findRepositoryByFullName('issmokk/repomind')
    if (!repo) throw new Error('Repo issmokk/repomind not found. Index it first.')
    const orgId = repo.orgId

    const camelSettings = await storage.getTeamSettingsDecrypted(orgId)

    const embeddingProvider = getEmbeddingProvider(camelSettings)
    const model = await getLanguageModel(camelSettings)
    console.log(`Using provider order: ${camelSettings.providerOrder.join(' > ')}`)
    console.log(`Embedding: ${camelSettings.embeddingProvider}`)

    let caseNum = 0
    const pipeline = async (question: string, repoId: string) => {
      caseNum++
      console.log(`[${caseNum}] ${question.slice(0, 60)}...`)
      const analysis = analyzeQuery(question)
      const ragConfig = {
        ...camelSettings,
        orgId: camelSettings.orgId as string,
        tokenBudget: 8000,
        maxGraphHops: Math.min(analysis.suggestedGraphDepth, camelSettings.maxGraphHops as number),
      }

      const retrievalStart = performance.now()
      const retrievalResult = await retrieveContext(
        question,
        [repoId],
        ragConfig,
        storage,
        embeddingProvider,
        serviceClient,
      )
      const retrievalMs = Math.round(performance.now() - retrievalStart)

      const contextWindow = buildContextWindow(question, retrievalResult, {
        explicitLanguage: analysis.detectedLanguage,
      })

      const genStart = performance.now()
      const { text } = await generateText({
        model,
        system: contextWindow.systemPrompt,
        messages: [
          {
            role: 'user' as const,
            content: [contextWindow.contextChunks, contextWindow.graphContext, contextWindow.userQuery]
              .filter(Boolean)
              .join('\n\n'),
          },
        ],
      })
      const generationMs = Math.round(performance.now() - genStart)

      return {
        answer: text,
        sources: retrievalResult.sources.map((s) => ({
          filePath: s.filePath,
          lineStart: s.lineStart,
          lineEnd: s.lineEnd,
        })),
        retrievedChunks: retrievalResult.chunks.map((c) => ({
          filePath: c.filePath,
          startLine: c.startLine,
          endLine: c.endLine,
          content: c.contextualizedContent ?? c.content,
        })),
        retrievalMs,
        generationMs,
      }
    }

    const judge = async (prompt: string) => {
      const { text } = await generateText({ model, prompt })
      return text
    }

    results = await runEvaluation({ pipeline, judge, storage })

    console.log('\n=== Golden Dataset Results ===')
    console.log(`Cases run: ${results.goldenSummary.count}`)
    console.log(`Faithfulness:      ${(results.goldenSummary.faithfulness.mean * 100).toFixed(1)}% (threshold: ${THRESHOLDS.faithfulness * 100}%)`)
    console.log(`Answer Relevance:  ${(results.goldenSummary.answerRelevance.mean * 100).toFixed(1)}% (threshold: ${THRESHOLDS.answerRelevance * 100}%)`)
    console.log(`Source Accuracy:   ${(results.goldenSummary.sourceAccuracy.mean * 100).toFixed(1)}% (threshold: ${THRESHOLDS.sourceAccuracy * 100}%)`)
    console.log(`Context Precision: ${(results.goldenSummary.contextPrecision.mean * 100).toFixed(1)}% (threshold: ${THRESHOLDS.contextPrecision * 100}%)`)
    console.log(`Hallucination:     ${(results.goldenSummary.hallucinationRate * 100).toFixed(1)}% (threshold: ${THRESHOLDS.hallucinationRate * 100}%)`)

    for (const r of results.goldenResults) {
      const latency = `${r.latency.retrievalMs}ms retrieval, ${r.latency.generationMs}ms generation`
      const faith = (r.metrics.faithfulness * 100).toFixed(0)
      const rel = (r.metrics.answerRelevance * 100).toFixed(0)
      console.log(`  [${faith}% faith, ${rel}% rel] ${r.question.slice(0, 70)}... (${latency})`)
    }

    expect(results.goldenSummary.count).toBeGreaterThan(0)
  }, 600_000)

  it('meets faithfulness threshold', () => {
    expect(results.goldenSummary.faithfulness.mean).toBeGreaterThanOrEqual(THRESHOLDS.faithfulness)
  })

  it('meets answer relevance threshold', () => {
    expect(results.goldenSummary.answerRelevance.mean).toBeGreaterThanOrEqual(THRESHOLDS.answerRelevance)
  })

  it('meets context precision threshold', () => {
    expect(results.goldenSummary.contextPrecision.mean).toBeGreaterThanOrEqual(THRESHOLDS.contextPrecision)
  })

  it('hallucination rate is below threshold', () => {
    expect(results.goldenSummary.hallucinationRate).toBeLessThanOrEqual(THRESHOLDS.hallucinationRate)
  })
})
