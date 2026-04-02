// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GemDependencyAnalyzer } from './gem-dependency'
import type { StorageProvider } from '@/lib/storage/types'
import type { GitHubClient } from '@/lib/github/client'
import type { Repository } from '@/types/repository'

const WT_PAYMENT_GEMFILE = `
source 'https://rubygems.org'

gem 'grape'
gem 'wt_core', '~> 1.0'
gem 'wt_sdk', '>= 2.0'
gem 'wt_orm', path: '../gems/wt_orm'
gem 'sidekiq-pro'
`

const WT_BOOKING_GEMFILE = `
source 'https://rubygems.org'

gem 'grape'
gem 'wt_core', '~> 1.0'
gem 'wt_sdk', '>= 2.1'
gem 'mongoid'
`

const STANDALONE_GEMFILE = `
source 'https://rubygems.org'

gem 'rails', '~> 7.0'
gem 'pg'
`

function makeRepo(overrides: Partial<Repository>): Repository {
  return {
    id: 'repo-1',
    orgId: 'org-1',
    name: 'test-repo',
    fullName: 'org/test-repo',
    url: 'https://github.com/org/test-repo',
    defaultBranch: 'main',
    lastIndexedCommit: null,
    githubAuthType: 'pat',
    githubAppInstallationId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('GemDependencyAnalyzer', () => {
  let analyzer: GemDependencyAnalyzer
  let storage: StorageProvider
  let githubClient: GitHubClient

  beforeEach(() => {
    analyzer = new GemDependencyAnalyzer()
    storage = {
      getCachedFile: vi.fn(),
    } as unknown as StorageProvider
    githubClient = {
      getFileContent: vi.fn(),
    } as unknown as GitHubClient
  })

  it('has the correct name', () => {
    expect(analyzer.name).toBe('gem-dependency')
  })

  it('only creates edges for local path gems when a single repo is analyzed', async () => {
    const repoA = makeRepo({ id: 'repo-a', name: 'wt_payment', fullName: 'org/wt_payment' })
    vi.mocked(storage.getCachedFile).mockResolvedValueOnce({
      id: 1, repoId: 'repo-a', filePath: 'Gemfile', content: WT_PAYMENT_GEMFILE,
      sha: 'abc', language: null, sizeBytes: 100, isGenerated: false, fetchedAt: new Date().toISOString(),
    })

    const edges = await analyzer.analyze([repoA], storage, githubClient)
    const gemNames = edges.map(e => e.sourceSymbol)
    expect(gemNames).toContain('wt_orm')
    expect(gemNames).not.toContain('wt_core')
    expect(gemNames).not.toContain('wt_sdk')
    expect(gemNames).not.toContain('grape')
    expect(gemNames).not.toContain('sidekiq-pro')
  })

  it('detects shared gems across repos and creates edges between them', async () => {
    const repoA = makeRepo({ id: 'repo-a', name: 'wt_payment', fullName: 'org/wt_payment' })
    const repoB = makeRepo({ id: 'repo-b', name: 'wt_booking', fullName: 'org/wt_booking' })

    vi.mocked(storage.getCachedFile)
      .mockImplementation(async (repoId: string) => {
        const content = repoId === 'repo-a' ? WT_PAYMENT_GEMFILE : WT_BOOKING_GEMFILE
        return {
          id: 1, repoId, filePath: 'Gemfile', content,
          sha: 'abc', language: null, sizeBytes: 100, isGenerated: false, fetchedAt: new Date().toISOString(),
        }
      })

    const edges = await analyzer.analyze([repoA, repoB], storage, githubClient)

    const sharedGemEdges = edges.filter(
      e => e.sourceRepoId !== e.targetRepoId && e.relationshipType === 'gem_dependency',
    )
    expect(sharedGemEdges.length).toBeGreaterThanOrEqual(2)

    const wtCoreEdges = sharedGemEdges.filter(e => e.sourceSymbol === 'wt_core')
    expect(wtCoreEdges.length).toBe(2)
    expect(wtCoreEdges.map(e => e.sourceRepoId).sort()).toEqual(['repo-a', 'repo-b'])
  })

  it('marks local path gems with metadata', async () => {
    const repoA = makeRepo({ id: 'repo-a', name: 'wt_payment', fullName: 'org/wt_payment' })
    vi.mocked(storage.getCachedFile).mockResolvedValueOnce({
      id: 1, repoId: 'repo-a', filePath: 'Gemfile', content: WT_PAYMENT_GEMFILE,
      sha: 'abc', language: null, sizeBytes: 100, isGenerated: false, fetchedAt: new Date().toISOString(),
    })

    const edges = await analyzer.analyze([repoA], storage, githubClient)
    const localGem = edges.find(e => e.sourceSymbol === 'wt_orm')
    expect(localGem).toBeDefined()
    expect(localGem!.metadata.is_local_gem).toBe(true)
    expect(localGem!.metadata.local_path).toBe('../gems/wt_orm')
  })

  it('handles missing Gemfile gracefully', async () => {
    const repoA = makeRepo({ id: 'repo-a', name: 'wt_payment', fullName: 'org/wt_payment' })
    vi.mocked(storage.getCachedFile).mockResolvedValueOnce(null)
    vi.mocked(githubClient.getFileContent).mockRejectedValueOnce(new Error('Not Found'))

    const edges = await analyzer.analyze([repoA], storage, githubClient)
    expect(edges).toEqual([])
  })

  it('falls back to GitHub API when cache misses', async () => {
    const repoA = makeRepo({ id: 'repo-a', name: 'wt_payment', fullName: 'org/wt_payment' })
    vi.mocked(storage.getCachedFile).mockResolvedValueOnce(null)
    vi.mocked(githubClient.getFileContent).mockResolvedValueOnce({
      content: WT_PAYMENT_GEMFILE, sha: 'abc', size: 100, encoding: 'utf-8',
    })

    const edges = await analyzer.analyze([repoA], storage, githubClient)
    expect(edges.length).toBeGreaterThan(0)
    expect(githubClient.getFileContent).toHaveBeenCalledWith('org', 'wt_payment', 'Gemfile', 'main')
  })

  it('sets confidence to 1.0 for all Gemfile declarations', async () => {
    const repoA = makeRepo({ id: 'repo-a', name: 'wt_payment', fullName: 'org/wt_payment' })
    const repoB = makeRepo({ id: 'repo-b', name: 'wt_booking', fullName: 'org/wt_booking' })
    vi.mocked(storage.getCachedFile).mockImplementation(async (repoId: string) => {
      const content = repoId === 'repo-a' ? WT_PAYMENT_GEMFILE : WT_BOOKING_GEMFILE
      return {
        id: 1, repoId, filePath: 'Gemfile', content,
        sha: 'abc', language: null, sizeBytes: 100, isGenerated: false, fetchedAt: new Date().toISOString(),
      }
    })

    const edges = await analyzer.analyze([repoA, repoB], storage, githubClient)
    expect(edges.length).toBeGreaterThan(0)
    for (const edge of edges) {
      expect(edge.confidence).toBe(1.0)
    }
  })

  it('ignores repos with only standalone gems (no wt_* prefix)', async () => {
    const repoA = makeRepo({ id: 'repo-a', name: 'standalone', fullName: 'org/standalone' })
    vi.mocked(storage.getCachedFile).mockResolvedValueOnce({
      id: 1, repoId: 'repo-a', filePath: 'Gemfile', content: STANDALONE_GEMFILE,
      sha: 'abc', language: null, sizeBytes: 100, isGenerated: false, fetchedAt: new Date().toISOString(),
    })

    const edges = await analyzer.analyze([repoA], storage, githubClient)
    expect(edges).toEqual([])
  })
})
