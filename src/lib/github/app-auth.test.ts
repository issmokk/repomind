// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockAuthFn = vi.fn()
vi.mock('@octokit/auth-app', () => ({
  createAppAuth: vi.fn(() => mockAuthFn),
}))

const TEST_PRIVATE_KEY = Buffer.from('-----BEGIN RSA PRIVATE KEY-----\ntest-key-content\n-----END RSA PRIVATE KEY-----').toString('base64')

describe('GitHubAppAuth', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GITHUB_APP_ID = '12345'
    process.env.GITHUB_APP_PRIVATE_KEY = TEST_PRIVATE_KEY
    mockAuthFn.mockResolvedValue({ token: 'ghs_installation_token_abc', expiresAt: '2099-01-01T00:00:00Z' })
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('decodes base64 private key from env var', async () => {
    const { createAppAuth } = await import('@octokit/auth-app')
    const { GitHubAppAuth } = await import('./app-auth')

    new GitHubAppAuth(999)
    expect(createAppAuth).toHaveBeenCalledWith(expect.objectContaining({
      appId: '12345',
      privateKey: expect.stringContaining('BEGIN RSA PRIVATE KEY'),
      installationId: 999,
    }))
  })

  it('returns authorization headers with installation token', async () => {
    const { GitHubAppAuth } = await import('./app-auth')
    const auth = new GitHubAppAuth(999)

    const headers = await auth.getHeaders()
    expect(headers.Authorization).toBe('Bearer ghs_installation_token_abc')
    expect(headers.Accept).toBe('application/vnd.github+json')
    expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28')
  })

  it('calls auth function with type installation', async () => {
    const { GitHubAppAuth } = await import('./app-auth')
    const auth = new GitHubAppAuth(999)

    await auth.getHeaders()
    expect(mockAuthFn).toHaveBeenCalledWith({ type: 'installation' })
  })

  it('implements GitHubAuthProvider interface', async () => {
    const { GitHubAppAuth } = await import('./app-auth')
    const auth = new GitHubAppAuth(999)
    expect(typeof auth.getHeaders).toBe('function')
    expect(typeof auth.getInstallationRepos).toBe('function')
  })

  it('fetches installation repos and maps to RepoInfo', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        repositories: [
          { name: 'repo1', full_name: 'org/repo1', default_branch: 'main', html_url: 'https://github.com/org/repo1', private: false },
          { name: 'repo2', full_name: 'org/repo2', default_branch: 'develop', html_url: 'https://github.com/org/repo2', private: true },
        ],
      }),
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse as never)

    const { GitHubAppAuth } = await import('./app-auth')
    const auth = new GitHubAppAuth(999)
    const repos = await auth.getInstallationRepos()

    expect(repos).toHaveLength(2)
    expect(repos[0]).toEqual({
      name: 'repo1',
      fullName: 'org/repo1',
      defaultBranch: 'main',
      url: 'https://github.com/org/repo1',
      private: false,
    })
  })

  it('throws if GITHUB_APP_ID is not set', async () => {
    delete process.env.GITHUB_APP_ID
    const { GitHubAppAuth } = await import('./app-auth')
    expect(() => new GitHubAppAuth(999)).toThrow('GITHUB_APP_ID')
  })

  it('throws if GITHUB_APP_PRIVATE_KEY is not set', async () => {
    delete process.env.GITHUB_APP_PRIVATE_KEY
    const { GitHubAppAuth } = await import('./app-auth')
    expect(() => new GitHubAppAuth(999)).toThrow('GITHUB_APP_PRIVATE_KEY')
  })
})
