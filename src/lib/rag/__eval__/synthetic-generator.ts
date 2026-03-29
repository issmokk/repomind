import type { StorageProvider } from '@/lib/storage/types'
import type { EvalTestCase } from './metrics'

type LlmGenerator = (prompt: string) => Promise<string>

export async function generateSyntheticDataset(
  storage: StorageProvider,
  repoId: string,
  llm: LlmGenerator,
  options?: { count?: number }
): Promise<EvalTestCase[]> {
  const count = options?.count ?? 20
  const factualCount = Math.round(count * 0.5)
  const multiContextCount = Math.round(count * 0.35)
  const _reasoningCount = count - factualCount - multiContextCount

  const testCases: EvalTestCase[] = []

  // Placeholder: In a full implementation, this would query code_chunks
  // and graph_edges to generate realistic test questions using the LLM.
  // For now, return an empty array indicating the generator needs
  // a seeded database to produce synthetic tests.

  // The structure for generated cases would be:
  // {
  //   question: "What does the buildScopeTree function do?",
  //   repoId: repoId,
  //   expectedSources: [{ filePath: "src/chunker.ts", lineStart: 45, lineEnd: 89 }],
  //   expectedAnswerContains: ["scope", "tree", "AST"]
  // }

  return testCases
}
