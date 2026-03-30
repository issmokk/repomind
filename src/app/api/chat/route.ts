import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { streamText } from 'ai'
import { getAuthContext } from '@/app/api/repos/_helpers'
import { retrieveContext } from '@/lib/rag/retriever'
import { buildContextWindow } from '@/lib/rag/prompt-builder'
import { analyzeQuery } from '@/lib/rag/query-analyzer'
import { getLanguageModel, getEmbeddingProvider } from '@/lib/rag/providers'
import type { RagConfig } from '@/lib/rag/types'

export const runtime = 'nodejs'

function mapErrorToResponse(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : String(err)

  if (message.includes('ECONNREFUSED')) {
    return NextResponse.json(
      { error: 'Ollama is not running. Start it with `ollama serve`.' },
      { status: 503 }
    )
  }
  if (message.includes('model not found') || message.includes('model_not_found')) {
    return NextResponse.json(
      { error: `Model not installed. Run \`ollama pull <model>\` to install it.` },
      { status: 503 }
    )
  }
  if (message.includes('No LLM provider available')) {
    return NextResponse.json({ error: message }, { status: 503 })
  }
  if (message.includes('Embedding dimension mismatch')) {
    return NextResponse.json(
      { error: 'Embedding dimension mismatch. Re-index your repositories.' },
      { status: 500 }
    )
  }
  if (message.includes('not found or not accessible')) {
    return NextResponse.json(
      { error: 'You do not have access to one or more requested repositories.' },
      { status: 403 }
    )
  }

  console.error('Chat API error:', err)
  return NextResponse.json(
    { error: 'An error occurred while processing your question.' },
    { status: 500 }
  )
}

export async function POST(req: Request) {
  const auth = await getAuthContext()
  if (auth instanceof NextResponse) return auth

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const repoIds = body.repoIds as string[] | undefined
  const sessionId = (body.sessionId as string) ?? null
  const filters = body.filters as Record<string, string> | undefined

  let question: string | undefined
  if (typeof body.question === 'string') {
    question = body.question
  } else if (Array.isArray(body.messages)) {
    const lastUserMsg = [...body.messages].reverse().find(
      (m: { role?: string }) => m.role === 'user'
    )
    if (lastUserMsg) {
      if (typeof lastUserMsg.content === 'string') {
        question = lastUserMsg.content
      } else if (Array.isArray(lastUserMsg.parts)) {
        question = lastUserMsg.parts
          .filter((p: { type?: string }) => p.type === 'text')
          .map((p: { text?: string }) => p.text)
          .join('')
      }
    }
  }

  if (!question || typeof question !== 'string') {
    return NextResponse.json(
      { error: 'Question and at least one repository ID are required.' },
      { status: 400 }
    )
  }
  if (!repoIds || !Array.isArray(repoIds) || repoIds.length === 0) {
    return NextResponse.json(
      { error: 'Question and at least one repository ID are required.' },
      { status: 400 }
    )
  }

  try {
    const teamSettings = await auth.storage.getTeamSettings(auth.orgId)
    const analysis = analyzeQuery(question, { maxGraphHops: teamSettings.maxGraphHops })

    const ragConfig: RagConfig = {
      ...teamSettings,
      orgId: auth.orgId,
      tokenBudget: 8000,
      maxGraphHops: Math.min(
        analysis.suggestedGraphDepth,
        teamSettings.maxGraphHops
      ),
    }

    const userRepos = await auth.storage.getRepositories(auth.supabase)
    const userRepoIds = new Set(userRepos.map((r) => r.id))
    for (const repoId of repoIds) {
      if (!userRepoIds.has(repoId)) {
        return NextResponse.json(
          { error: 'You do not have access to one or more requested repositories.' },
          { status: 403 }
        )
      }
    }

    const embeddingProvider = getEmbeddingProvider(teamSettings)
    const retrievalStart = performance.now()
    const retrievalResult = await retrieveContext(
      question,
      repoIds,
      ragConfig,
      auth.storage,
      embeddingProvider,
      auth.supabase
    )
    const retrievalLatencyMs = Math.round(performance.now() - retrievalStart)

    const contextWindow = buildContextWindow(question, retrievalResult, {
      explicitLanguage: filters?.language ?? analysis.detectedLanguage,
    })

    const model = await getLanguageModel(teamSettings)
    const sources = retrievalResult.sources
    const genStart = performance.now()

    const result = streamText({
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
      onFinish: ({ text }) => {
        after(async () => {
          try {
            await auth.storage.saveMessage({
              orgId: auth.orgId,
              userId: auth.userId,
              sessionId,
              repoIds,
              question,
              answer: text,
              sources,
              confidence: retrievalResult.confidence,
              modelUsed: (model as unknown as { modelId?: string }).modelId ?? 'unknown',
              providerUsed: (model as unknown as { provider?: string }).provider ?? 'unknown',
              retrievalLatencyMs,
              generationLatencyMs: Math.round(performance.now() - genStart),
            })
          } catch (err) {
            console.error('Failed to save chat message:', err)
          }
        })
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (err) {
    return mapErrorToResponse(err)
  }
}
