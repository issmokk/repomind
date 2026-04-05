// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type {
  GitHubAuthType,
  Repository,
  RepositorySettings,
  CachedFile,
} from '../repository'
import type {
  IndexingJobStatus,
  IndexingJobTrigger,
  IndexingJob,
  CodeChunk,
  ChunkResult as _ChunkResult,
  FileMetadata as _FileMetadata,
} from '../indexing'
import type { RelationshipType, GraphEdge } from '../graph'
import type { EmbeddingProviderName as _EmbeddingProviderName, EmbeddingConfig } from '../embedding'

describe('Schema Types', () => {
  describe('Repository', () => {
    it('has all required fields', () => {
      const repo: Repository = {
        id: 'uuid-1',
        orgId: 'uuid-2',
        name: 'repo',
        fullName: 'owner/repo',
        url: 'https://github.com/owner/repo',
        defaultBranch: 'main',
        lastIndexedCommit: null,
        githubAuthType: 'pat',
        githubAppInstallationId: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }
      expect(repo.id).toBeDefined()
      expect(repo.orgId).toBeDefined()
      expect(repo.fullName).toBeDefined()
      expect(repo.lastIndexedCommit).toBeNull()
      expect(repo.githubAuthType).toBe('pat')
    })
  })

  describe('RepositorySettings', () => {
    it('has correct default values documented', () => {
      const settings: RepositorySettings = {
        id: 'uuid-1',
        repoId: 'uuid-2',
        branchFilter: ['main'],
        includePatterns: [],
        excludePatterns: [],
        embeddingProvider: 'ollama',
        embeddingModel: 'gte-qwen2-1.5b-instruct',
        indexingMethod: 'manual',
        autoIndexOnAdd: false,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }
      expect(settings.branchFilter).toEqual(['main'])
      expect(settings.embeddingProvider).toBe('ollama')
      expect(settings.embeddingModel).toBe('gte-qwen2-1.5b-instruct')
      expect(settings.autoIndexOnAdd).toBe(false)
    })
  })

  describe('CachedFile', () => {
    it('includes all required fields', () => {
      const file: CachedFile = {
        id: 1,
        repoId: 'uuid-1',
        filePath: 'src/index.ts',
        content: 'export {}',
        sha: 'abc123',
        language: 'typescript',
        sizeBytes: 100,
        isGenerated: false,
        fetchedAt: '2026-01-01T00:00:00Z',
      }
      expect(file.repoId).toBeDefined()
      expect(file.filePath).toBeDefined()
      expect(file.sha).toBeDefined()
      expect(file.sizeBytes).toBe(100)
      expect(file.isGenerated).toBe(false)
    })
  })

  describe('CodeChunk', () => {
    it('includes embedding as number[] | null', () => {
      const chunk: CodeChunk = {
        id: 1,
        repoId: 'uuid-1',
        filePath: 'src/index.ts',
        chunkIndex: 0,
        content: 'function foo() {}',
        contextualizedContent: 'File: src/index.ts\n---\nfunction foo() {}',
        language: 'typescript',
        symbolName: 'foo',
        symbolType: 'function',
        startLine: 1,
        endLine: 3,
        parentScope: null,
        commitSha: 'abc123',
        embedding: null,
        embeddingModel: null,
        createdAt: '2026-01-01T00:00:00Z',
      }
      expect(chunk.embedding).toBeNull()

      const chunkWithEmbedding: CodeChunk = { ...chunk, embedding: [0.1, 0.2], embeddingModel: 'ollama' }
      expect(chunkWithEmbedding.embedding).toHaveLength(2)
    })
  })

  describe('GraphEdge', () => {
    it('relationship_type is constrained to enum values', () => {
      const validTypes: RelationshipType[] = ['calls', 'imports', 'inherits', 'composes', 'depends_on', 'external_dep']
      expect(validTypes).toHaveLength(6)

      const edge: GraphEdge = {
        id: 1,
        repoId: 'uuid-1',
        targetRepoId: null,
        sourceFile: 'src/a.ts',
        sourceSymbol: 'foo',
        sourceType: 'function',
        targetFile: 'src/b.ts',
        targetSymbol: 'bar',
        targetType: 'function',
        relationshipType: 'calls',
        metadata: {},
        confidence: null,
        createdAt: '2026-01-01T00:00:00Z',
      }
      expect(validTypes).toContain(edge.relationshipType)
    })
  })

  describe('IndexingJob', () => {
    it('status is constrained to enum values', () => {
      const validStatuses: IndexingJobStatus[] = [
        'pending', 'fetching_files', 'processing', 'embedding', 'completed', 'failed', 'partial',
      ]
      expect(validStatuses).toHaveLength(7)
    })

    it('trigger_type is constrained to enum values', () => {
      const validTriggers: IndexingJobTrigger[] = ['manual', 'git_diff', 'webhook', 'install']
      expect(validTriggers).toHaveLength(4)
    })

    it('has all required fields', () => {
      const job: IndexingJob = {
        id: 'uuid-1',
        repoId: 'uuid-2',
        status: 'pending',
        triggerType: 'manual',
        fromCommit: null,
        toCommit: 'abc123',
        totalFiles: 10,
        processedFiles: 0,
        failedFiles: 0,
        currentFile: null,
        currentStage: null,
        errorLog: [],
        lastHeartbeatAt: '2026-01-01T00:00:00Z',
        startedAt: '2026-01-01T00:00:00Z',
        completedAt: null,
      }
      expect(job.status).toBe('pending')
      expect(job.lastHeartbeatAt).toBeDefined()

      const jobWithNulls: IndexingJob = { ...job, lastHeartbeatAt: null, startedAt: null }
      expect(jobWithNulls.lastHeartbeatAt).toBeNull()
      expect(jobWithNulls.startedAt).toBeNull()
    })
  })

  describe('GitHubAuthType', () => {
    it('is constrained to pat and github_app', () => {
      const validTypes: GitHubAuthType[] = ['pat', 'github_app']
      expect(validTypes).toHaveLength(2)
    })
  })

  describe('EmbeddingConfig', () => {
    it('has provider, model, and dimensions', () => {
      const config: EmbeddingConfig = {
        provider: 'ollama',
        model: 'gte-qwen2-1.5b-instruct',
        dimensions: 1536,
      }
      expect(config.provider).toBe('ollama')
      expect(config.dimensions).toBe(1536)
    })
  })
})
