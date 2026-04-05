// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GitHubClient } from './client'
import type { GitHubAuthProvider } from './types'

function mockFetchResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'X-RateLimit-Remaining': '1000', 'X-RateLimit-Reset': '0', ...headers }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response
}

describe('GitHubClient', () => {
  let client: GitHubClient
  const mockAuth: GitHubAuthProvider = {
    getHeaders: vi.fn(async () => ({ Authorization: 'Bearer test', Accept: 'application/vnd.github+json' })),
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    client = new GitHubClient(mockAuth, 'https://api.github.com')
  })

  it('getRepoMetadata fetches and returns repo info', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(
      mockFetchResponse({ name: 'repo', full_name: 'owner/repo', default_branch: 'main', html_url: 'https://github.com/owner/repo', private: false }),
    )))

    const result = await client.getRepoMetadata('owner', 'repo')
    expect(result.fullName).toBe('owner/repo')
    expect(result.defaultBranch).toBe('main')
  })

  it('getBranchHeadSha returns the commit SHA for a branch', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(
      mockFetchResponse({ object: { sha: 'abc123commit' } }),
    )))

    const result = await client.getBranchHeadSha('owner', 'repo', 'main')
    expect(result).toBe('abc123commit')
  })

  it('getFileTree returns recursive file list', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(
      mockFetchResponse({
        tree: [
          { path: 'src/index.ts', sha: 'abc', size: 100, type: 'blob' },
          { path: 'src', sha: 'def', size: 0, type: 'tree' },
          { path: 'src/lib/utils.ts', sha: 'ghi', size: 200, type: 'blob' },
        ],
        truncated: false,
      }),
    )))

    const result = await client.getFileTree('owner', 'repo', 'main')
    expect(result).toHaveLength(2)
    expect(result[0].path).toBe('src/index.ts')
    expect(result[1].path).toBe('src/lib/utils.ts')
  })

  it('getFileContent fetches and decodes base64 content', async () => {
    const encoded = Buffer.from('export const foo = 1').toString('base64')
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(
      mockFetchResponse({ content: encoded, sha: 'abc123', size: 20 }),
    )))

    const result = await client.getFileContent('owner', 'repo', 'src/index.ts', 'main')
    expect(result.content).toBe('export const foo = 1')
    expect(result.sha).toBe('abc123')
  })

  it('getFileContent uses Blobs API directly when blobSha is provided', async () => {
    const encoded = Buffer.from('large file content').toString('base64')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockFetchResponse({ content: encoded, sha: 'blob-sha', size: 2000000 }))

    vi.stubGlobal('fetch', fetchMock)

    const result = await client.getFileContent('owner', 'repo', 'big-file.bin', 'main', 'blob-sha')
    expect(result.content).toBe('large file content')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('/git/blobs/blob-sha')
  })

  it('compareCommits returns diff entries', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(
      mockFetchResponse({
        files: [
          { filename: 'added.ts', status: 'added', sha: 'a1' },
          { filename: 'modified.ts', status: 'modified', sha: 'a2' },
          { filename: 'deleted.ts', status: 'removed', sha: 'a3' },
          { filename: 'renamed.ts', status: 'renamed', previous_filename: 'old.ts', sha: 'a4' },
          { filename: 'changed.ts', status: 'changed', sha: 'a5' },
        ],
      }),
    )))

    const result = await client.compareCommits('owner', 'repo', 'abc', 'def')
    expect(result).toHaveLength(5)
    expect(result[0].status).toBe('added')
    expect(result[3].status).toBe('renamed')
    expect(result[3].previousFilename).toBe('old.ts')
    expect(result[4].status).toBe('modified')
  })

  it('getCommitsBehind returns commit count and head SHA', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(
      mockFetchResponse({
        ahead_by: 3,
        commits: [
          { sha: 'commit-1' },
          { sha: 'commit-2' },
          { sha: 'commit-3' },
        ],
      }),
    )))

    const result = await client.getCommitsBehind('owner', 'repo', 'abc123', 'main')
    expect(result.behind).toBe(3)
    expect(result.headSha).toBe('commit-3')
  })

  it('getCommitsBehind returns base SHA when no commits ahead', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(
      mockFetchResponse({
        ahead_by: 0,
        commits: [],
      }),
    )))

    const result = await client.getCommitsBehind('owner', 'repo', 'abc123', 'main')
    expect(result.behind).toBe(0)
    expect(result.headSha).toBe('abc123')
  })

  it('getCommitsBehind calls correct compare URL', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(
      mockFetchResponse({ ahead_by: 1, commits: [{ sha: 'head-sha' }] }),
    ))
    vi.stubGlobal('fetch', fetchMock)

    await client.getCommitsBehind('owner', 'repo', 'base-sha', 'main')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/compare/base-sha...main',
      expect.any(Object),
    )
  })

  it('404 response throws descriptive error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(
      mockFetchResponse({ message: 'Not Found' }, 404),
    )))

    await expect(client.getRepoMetadata('owner', 'nonexistent')).rejects.toThrow(
      /not found or not accessible/,
    )
  })

  it('rate limit handling logs warning when remaining is low', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(
      mockFetchResponse(
        { name: 'repo', full_name: 'o/r', default_branch: 'main', html_url: '', private: false },
        200,
        { 'X-RateLimit-Remaining': '50', 'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 1) },
      ),
    )))

    await client.getRepoMetadata('o', 'r')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('rate limit'))
    warnSpy.mockRestore()
  })
})
