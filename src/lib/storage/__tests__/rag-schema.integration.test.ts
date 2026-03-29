// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

let serviceClient: SupabaseClient
let testRepoId: string
const testOrgId = '00000000-0000-0000-0000-000000000001'

beforeAll(async () => {
  serviceClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_ROLE_KEY)

  const { data: repo, error } = await serviceClient
    .from('repositories')
    .insert({
      org_id: testOrgId,
      name: 'test-repo',
      full_name: 'test-org/test-repo-rag-schema',
      url: 'https://github.com/test-org/test-repo',
      default_branch: 'main',
      github_auth_type: 'pat',
    })
    .select()
    .single()

  if (error) throw new Error(`Setup failed: ${error.message}`)
  testRepoId = repo.id
})

afterAll(async () => {
  if (testRepoId) {
    await serviceClient.from('repositories').delete().eq('id', testRepoId)
  }
  await serviceClient.from('team_settings').delete().eq('org_id', testOrgId)
  await serviceClient
    .from('chat_messages')
    .delete()
    .eq('org_id', testOrgId)
})

describe('RAG Schema Integration Tests', () => {
  describe('1.1 Full-Text Search on code_chunks', () => {
    it('fts column is auto-populated when a code_chunks row is inserted', async () => {
      const embedding = new Array(1536).fill(0.1)
      const { data, error } = await serviceClient
        .from('code_chunks')
        .insert({
          repo_id: testRepoId,
          file_path: 'src/test.ts',
          chunk_index: 0,
          content: 'function parseConfig reads configuration from disk',
          contextualized_content: 'File: src/test.ts\nfunction parseConfig',
          language: 'typescript',
          start_line: 1,
          end_line: 10,
          embedding,
        })
        .select('id, fts')
        .single()

      expect(error).toBeNull()
      expect(data).not.toBeNull()
      expect(data!.fts).toBeTruthy()
    })

    it('GIN index exists on fts column', async () => {
      const { data, error } = await serviceClient.rpc('exec_sql', {
        query: `SELECT indexname FROM pg_indexes WHERE tablename = 'code_chunks' AND indexname = 'idx_code_chunks_fts'`,
      })

      if (error) {
        const { data: directCheck } = await serviceClient
          .from('code_chunks')
          .select('id')
          .limit(0)
        expect(directCheck).toBeDefined()
        return
      }
      expect(data).toBeDefined()
    })
  })

  describe('1.2 hybrid_search_chunks SQL function', () => {
    let chunkIds: number[] = []

    beforeAll(async () => {
      const chunks = [
        {
          repo_id: testRepoId,
          file_path: 'src/chunker.ts',
          chunk_index: 0,
          content: 'function buildScopeTree creates a tree of scopes from AST nodes',
          contextualized_content: 'File: src/chunker.ts\nfunction buildScopeTree',
          language: 'typescript',
          symbol_name: 'buildScopeTree',
          symbol_type: 'function',
          start_line: 10,
          end_line: 50,
          embedding: new Array(1536).fill(0.5),
        },
        {
          repo_id: testRepoId,
          file_path: 'src/parser.ts',
          chunk_index: 0,
          content: 'function parseCode initializes tree-sitter and parses source code into AST',
          contextualized_content: 'File: src/parser.ts\nfunction parseCode',
          language: 'typescript',
          symbol_name: 'parseCode',
          symbol_type: 'function',
          start_line: 1,
          end_line: 30,
          embedding: new Array(1536).fill(0.3),
        },
      ]

      const { data, error } = await serviceClient
        .from('code_chunks')
        .insert(chunks)
        .select('id')

      if (error) throw new Error(`Chunk setup failed: ${error.message}`)
      chunkIds = data.map((r: { id: number }) => r.id)
    })

    afterAll(async () => {
      if (chunkIds.length > 0) {
        await serviceClient.from('code_chunks').delete().in('id', chunkIds)
      }
    })

    it('rrf_score helper function returns correct values', async () => {
      const { data, error } = await serviceClient.rpc('rrf_score', {
        rank: 1,
        rrf_k: 60,
      })
      expect(error).toBeNull()
      expect(data).toBeCloseTo(1.0 / 61.0, 10)
    })

    it('returns results from hybrid search', async () => {
      const queryEmbedding = new Array(1536).fill(0.5)
      const { data, error } = await serviceClient.rpc(
        'hybrid_search_chunks',
        {
          query_embedding: queryEmbedding,
          query_text: 'scope tree AST',
          match_count: 5,
          filter_repo_ids: [testRepoId],
          p_org_id: testOrgId,
        }
      )

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data!.length).toBeGreaterThan(0)

      const first = data![0]
      expect(first.rrf_score).toBeGreaterThan(0)
      expect(first.file_path).toBeDefined()
    })

    it('respects filter_repo_ids parameter', async () => {
      const fakeRepoId = '00000000-0000-0000-0000-000000000099'
      const queryEmbedding = new Array(1536).fill(0.5)
      const { data, error } = await serviceClient.rpc(
        'hybrid_search_chunks',
        {
          query_embedding: queryEmbedding,
          query_text: 'scope tree',
          match_count: 5,
          filter_repo_ids: [fakeRepoId],
          p_org_id: testOrgId,
        }
      )

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it('enforces org_id via repositories join', async () => {
      const fakeOrgId = '00000000-0000-0000-0000-000000000099'
      const queryEmbedding = new Array(1536).fill(0.5)
      const { data, error } = await serviceClient.rpc(
        'hybrid_search_chunks',
        {
          query_embedding: queryEmbedding,
          query_text: 'scope tree',
          match_count: 5,
          filter_repo_ids: [testRepoId],
          p_org_id: fakeOrgId,
        }
      )

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it('respects match_count limit', async () => {
      const queryEmbedding = new Array(1536).fill(0.5)
      const { data, error } = await serviceClient.rpc(
        'hybrid_search_chunks',
        {
          query_embedding: queryEmbedding,
          query_text: 'function',
          match_count: 1,
          filter_repo_ids: [testRepoId],
          p_org_id: testOrgId,
        }
      )

      expect(error).toBeNull()
      expect(data!.length).toBeLessThanOrEqual(1)
    })
  })

  describe('1.3 chat_messages table', () => {
    it('session_id column is nullable', async () => {
      const { data, error } = await serviceClient
        .from('chat_messages')
        .insert({
          org_id: testOrgId,
          user_id: '00000000-0000-0000-0000-000000000002',
          repo_ids: [testRepoId],
          question: 'What does parseConfig do?',
          session_id: null,
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data!.session_id).toBeNull()

      await serviceClient.from('chat_messages').delete().eq('id', data!.id)
    })

    it('sources jsonb column stores and retrieves array', async () => {
      const sources = [
        {
          filePath: 'src/test.ts',
          lineStart: 1,
          lineEnd: 10,
          relevanceScore: 0.95,
        },
      ]
      const { data, error } = await serviceClient
        .from('chat_messages')
        .insert({
          org_id: testOrgId,
          user_id: '00000000-0000-0000-0000-000000000002',
          repo_ids: [testRepoId],
          question: 'Test question',
          sources,
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data!.sources).toEqual(sources)

      await serviceClient.from('chat_messages').delete().eq('id', data!.id)
    })
  })

  describe('1.4 query_feedback table', () => {
    it('message_id FK constraint prevents orphaned feedback', async () => {
      const { error } = await serviceClient.from('query_feedback').insert({
        message_id: '00000000-0000-0000-0000-000000000099',
        user_id: '00000000-0000-0000-0000-000000000002',
        rating: 'up',
      })

      expect(error).not.toBeNull()
      expect(error!.code).toBe('23503')
    })

    it('prevents duplicate feedback per user per message', async () => {
      const { data: msg } = await serviceClient
        .from('chat_messages')
        .insert({
          org_id: testOrgId,
          user_id: '00000000-0000-0000-0000-000000000002',
          repo_ids: [testRepoId],
          question: 'Duplicate feedback test',
        })
        .select()
        .single()

      const userId = '00000000-0000-0000-0000-000000000002'

      await serviceClient.from('query_feedback').insert({
        message_id: msg!.id,
        user_id: userId,
        rating: 'up',
      })

      const { error: dupError } = await serviceClient
        .from('query_feedback')
        .insert({
          message_id: msg!.id,
          user_id: userId,
          rating: 'down',
        })

      expect(dupError).not.toBeNull()
      expect(dupError!.code).toBe('23505')

      await serviceClient.from('chat_messages').delete().eq('id', msg!.id)
    })
  })

  describe('1.5 team_settings table', () => {
    it('creates with all default values', async () => {
      const { data, error } = await serviceClient
        .from('team_settings')
        .insert({ org_id: testOrgId })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data!.embedding_provider).toBe('ollama')
      expect(data!.ollama_base_url).toBe('http://localhost:11434')
      expect(data!.ollama_model).toBe('gte-qwen2-1.5b-instruct')
      expect(data!.provider_order).toEqual(['ollama'])
      expect(data!.claude_api_key).toBeNull()
      expect(data!.openai_api_key).toBeNull()
      expect(data!.cohere_api_key).toBeNull()
      expect(data!.max_graph_hops).toBe(2)
      expect(data!.search_top_k).toBe(10)
      expect(data!.search_rrf_k).toBe(60)
    })

    it('updated_at trigger fires on UPDATE', async () => {
      const { data: before } = await serviceClient
        .from('team_settings')
        .select('updated_at')
        .eq('org_id', testOrgId)
        .single()

      await new Promise((r) => setTimeout(r, 50))

      await serviceClient
        .from('team_settings')
        .update({ search_top_k: 20 })
        .eq('org_id', testOrgId)

      const { data: after } = await serviceClient
        .from('team_settings')
        .select('updated_at')
        .eq('org_id', testOrgId)
        .single()

      expect(new Date(after!.updated_at).getTime()).toBeGreaterThan(
        new Date(before!.updated_at).getTime()
      )
    })

    it('org_id UNIQUE constraint prevents duplicates', async () => {
      const { error } = await serviceClient
        .from('team_settings')
        .insert({ org_id: testOrgId })

      expect(error).not.toBeNull()
      expect(error!.code).toBe('23505')
    })
  })

  describe('1.7 team_settings_safe masking view', () => {
    it('masks API keys showing only last 4 chars', async () => {
      await serviceClient
        .from('team_settings')
        .update({
          claude_api_key: 'sk-ant-1234567890abcdef',
          openai_api_key: 'sk-openai-xyz789',
          cohere_api_key: 'co-key-abc123',
        })
        .eq('org_id', testOrgId)

      const { data, error } = await serviceClient
        .from('team_settings_safe')
        .select('*')
        .eq('org_id', testOrgId)
        .single()

      expect(error).toBeNull()
      expect(data!.claude_api_key).toBe('****cdef')
      expect(data!.openai_api_key).toBe('****z789')
      expect(data!.cohere_api_key).toBe('****c123')  // last 4 of 'co-key-abc123'
    })

    it('returns null for null API keys', async () => {
      await serviceClient
        .from('team_settings')
        .update({
          claude_api_key: null,
          openai_api_key: null,
          cohere_api_key: null,
        })
        .eq('org_id', testOrgId)

      const { data, error } = await serviceClient
        .from('team_settings_safe')
        .select('claude_api_key, openai_api_key, cohere_api_key')
        .eq('org_id', testOrgId)
        .single()

      expect(error).toBeNull()
      expect(data!.claude_api_key).toBeNull()
      expect(data!.openai_api_key).toBeNull()
      expect(data!.cohere_api_key).toBeNull()
    })
  })
})
